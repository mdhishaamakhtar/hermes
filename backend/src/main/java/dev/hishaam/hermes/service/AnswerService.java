package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.AnswerRequest;
import dev.hishaam.hermes.dto.LockInRequest;
import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.entity.AnswerOption;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnswerService {

  private final ParticipantAnswerRepository answerRepository;
  private final ParticipantService participantService;
  private final SessionSnapshotService snapshotService;
  private final SessionLiveStateService liveStateService;
  private final SessionEngine engine;
  private final EntityManager entityManager;

  public AnswerService(
      ParticipantAnswerRepository answerRepository,
      ParticipantService participantService,
      SessionSnapshotService snapshotService,
      SessionLiveStateService liveStateService,
      SessionEngine engine,
      EntityManager entityManager) {
    this.answerRepository = answerRepository;
    this.participantService = participantService;
    this.snapshotService = snapshotService;
    this.liveStateService = liveStateService;
    this.engine = engine;
    this.entityManager = entityManager;
  }

  @Transactional
  public void submitAnswer(Long sessionId, AnswerRequest request) {
    String sid = sessionId.toString();
    Long participantId = participantService.resolveParticipantId(request.rejoinToken());

    QuizSnapshot.QuestionSnapshot question =
        requireMutableCurrentQuestion(sid, request.questionId());
    Set<Long> selectedOptionIds = normalizeSelectedOptionIds(request.selectedOptionIds());
    validateSelections(question, selectedOptionIds);

    ParticipantAnswer answer =
        answerRepository
            .findByParticipantIdAndQuestionId(participantId, request.questionId())
            .orElseGet(
                () ->
                    ParticipantAnswer.builder()
                        .sessionId(sessionId)
                        .participantId(participantId)
                        .questionId(request.questionId())
                        .build());

    ensureAnswerMutable(answer);

    Set<Long> previousSelectionIds = previousSelectionIds(sid, participantId, answer);
    answer.setSelectedOptions(toAnswerOptionReferences(selectedOptionIds));
    answer.setAnsweredAt(selectedOptionIds.isEmpty() ? null : OffsetDateTime.now());
    answerRepository.save(answer);

    liveStateService.replaceParticipantSelections(
        sid, request.questionId(), participantId, previousSelectionIds, selectedOptionIds);
    broadcastAnswerState(sessionId, request.questionId());
  }

  @Transactional
  public void lockInAnswer(Long sessionId, LockInRequest request) {
    String sid = sessionId.toString();
    Long participantId = participantService.resolveParticipantId(request.rejoinToken());

    requireMutableCurrentQuestion(sid, request.questionId());

    ParticipantAnswer answer =
        answerRepository
            .findByParticipantIdAndQuestionId(participantId, request.questionId())
            .orElseThrow(() -> AppException.conflict("Cannot lock in before submitting an answer"));

    ensureAnswerMutable(answer);
    if (answer.getSelectedOptions().isEmpty()) {
      throw AppException.conflict("Cannot lock in without a selection");
    }

    OffsetDateTime frozenAt = OffsetDateTime.now();
    answer.setLockedIn(true);
    answer.setFrozenAt(frozenAt);
    answerRepository.save(answer);

    liveStateService.markLockedIn(sid, request.questionId(), participantId);
    broadcastAnswerState(sessionId, request.questionId());
  }

  private QuizSnapshot.QuestionSnapshot requireMutableCurrentQuestion(String sid, Long questionId) {
    String status = liveStateService.getStatus(sid);
    if (!SessionStatus.ACTIVE.name().equals(status)) {
      throw AppException.conflict("Session is not accepting answers");
    }

    String questionState = liveStateService.getQuestionState(sid);
    if (!QuestionLifecycleState.TIMED.name().equals(questionState)) {
      throw AppException.conflict("Question is not currently accepting answers");
    }

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);

    // For ENTIRE_PASSAGE mode: accept answers for any sub-question in the current passage
    String currentPassageIdStr = liveStateService.getCurrentPassageId(sid);
    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);
      if (passage == null || !passage.subQuestionIds().contains(questionId)) {
        throw AppException.conflict("Question does not belong to the current passage");
      }
    } else {
      String currentQuestionId = liveStateService.getCurrentQuestionId(sid);
      if (currentQuestionId == null || !currentQuestionId.equals(questionId.toString())) {
        throw AppException.conflict("Question is no longer active");
      }
    }

    QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
    if (question == null) {
      throw AppException.notFound("Question not found in session snapshot");
    }

    return question;
  }

  private Set<Long> normalizeSelectedOptionIds(Iterable<Long> selectedOptionIds) {
    Set<Long> normalized = new LinkedHashSet<>();
    for (Long optionId : selectedOptionIds) {
      if (optionId == null) {
        throw AppException.badRequest("selectedOptionIds cannot contain null values");
      }
      normalized.add(optionId);
    }
    return normalized;
  }

  private void validateSelections(
      QuizSnapshot.QuestionSnapshot question, Set<Long> selectedOptionIds) {
    Set<Long> validOptionIds =
        question.options().stream()
            .map(QuizSnapshot.OptionSnapshot::id)
            .collect(LinkedHashSet::new, Set::add, Set::addAll);
    if (!validOptionIds.containsAll(selectedOptionIds)) {
      throw AppException.badRequest(
          "Selection contains an option that does not belong to the question");
    }

    if ("SINGLE_SELECT".equals(question.questionType()) && selectedOptionIds.size() > 1) {
      throw AppException.badRequest("SINGLE_SELECT questions require exactly one selected option");
    }
  }

  private void ensureAnswerMutable(ParticipantAnswer answer) {
    if (answer.isLockedIn() || answer.getFrozenAt() != null) {
      throw AppException.conflict("Answer is already frozen");
    }
  }

  private Set<Long> previousSelectionIds(String sid, Long participantId, ParticipantAnswer answer) {
    Set<Long> previousSelectionIds =
        liveStateService.getParticipantSelectionIds(sid, answer.getQuestionId(), participantId);
    if (!previousSelectionIds.isEmpty()) {
      return previousSelectionIds;
    }

    return answer.getSelectedOptions().stream()
        .map(AnswerOption::getId)
        .collect(LinkedHashSet::new, Set::add, Set::addAll);
  }

  private Set<AnswerOption> toAnswerOptionReferences(Set<Long> selectedOptionIds) {
    Set<AnswerOption> selectedOptions = new LinkedHashSet<>();
    selectedOptionIds.forEach(
        optionId -> selectedOptions.add(entityManager.getReference(AnswerOption.class, optionId)));
    return selectedOptions;
  }

  private void broadcastAnswerState(Long sessionId, Long questionId) {
    String sid = sessionId.toString();
    Map<Long, Long> counts = liveStateService.getQuestionCounts(sid, questionId);
    long totalAnswered = liveStateService.getTotalAnswered(sid, questionId);
    long totalParticipants = liveStateService.getParticipantCount(sid);
    long totalLockedIn = liveStateService.getTotalLockedIn(sid, questionId);

    engine.broadcastAnswerUpdate(
        sessionId, questionId, counts, totalAnswered, totalParticipants, totalLockedIn);
  }
}
