package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.AnswerRequest;
import dev.hishaam.hermes.dto.session.AnswerStats;
import dev.hishaam.hermes.dto.session.LockInRequest;
import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.entity.enums.QuestionType;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.redis.SessionAnswerStatsRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.session.SessionEventPublisher;
import dev.hishaam.hermes.service.session.SessionSnapshotService;
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
  private final SessionStateRedisRepository stateStore;
  private final SessionAnswerStatsRedisRepository answerStatsStore;
  private final SessionEventPublisher eventPublisher;

  public AnswerService(
      ParticipantAnswerRepository answerRepository,
      ParticipantService participantService,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionAnswerStatsRedisRepository answerStatsStore,
      SessionEventPublisher eventPublisher) {
    this.answerRepository = answerRepository;
    this.participantService = participantService;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.answerStatsStore = answerStatsStore;
    this.eventPublisher = eventPublisher;
  }

  @Transactional
  public void submitAnswer(Long sessionId, AnswerRequest request) {
    Long participantId = participantService.resolveParticipantId(request.rejoinToken(), sessionId);

    QuizSnapshot.QuestionSnapshot question =
        requireMutableCurrentQuestion(sessionId, request.questionId());
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

    Set<Long> previousSelectionIds = previousSelectionIds(sessionId, participantId, answer);
    answer.setSelectedOptionIds(selectedOptionIds);
    answer.setAnsweredAt(selectedOptionIds.isEmpty() ? null : OffsetDateTime.now());
    answerRepository.save(answer);

    answerStatsStore.replaceParticipantSelections(
        sessionId, request.questionId(), participantId, previousSelectionIds, selectedOptionIds);
    broadcastAnswerState(sessionId, request.questionId());
  }

  @Transactional
  public void lockInAnswer(Long sessionId, LockInRequest request) {
    Long participantId = participantService.resolveParticipantId(request.rejoinToken(), sessionId);

    requireMutableCurrentQuestion(sessionId, request.questionId());

    ParticipantAnswer answer =
        answerRepository
            .findByParticipantIdAndQuestionId(participantId, request.questionId())
            .orElseThrow(() -> AppException.conflict("Cannot lock in before submitting an answer"));

    ensureAnswerMutable(answer);
    if (answer.getSelectedOptionIds().isEmpty()) {
      throw AppException.conflict("Cannot lock in without a selection");
    }

    OffsetDateTime frozenAt = OffsetDateTime.now();
    answer.setLockedIn(true);
    answer.setFrozenAt(frozenAt);
    answerRepository.save(answer);

    answerStatsStore.markLockedIn(sessionId, request.questionId(), participantId);
    broadcastAnswerState(sessionId, request.questionId());
  }

  private QuizSnapshot.QuestionSnapshot requireMutableCurrentQuestion(
      Long sessionId, Long questionId) {
    String status = stateStore.getStatus(sessionId);
    if (!SessionStatus.ACTIVE.name().equals(status)) {
      throw AppException.conflict("Session is not accepting answers");
    }

    String questionState = stateStore.getQuestionState(sessionId);
    if (!QuestionLifecycleState.TIMED.name().equals(questionState)) {
      throw AppException.conflict("Question is not currently accepting answers");
    }

    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);

    // For ENTIRE_PASSAGE mode: accept answers for any sub-question in the current passage
    String currentPassageIdStr = stateStore.getCurrentPassageId(sessionId);
    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);
      if (passage == null || !passage.subQuestionIds().contains(questionId)) {
        throw AppException.conflict("Question does not belong to the current passage");
      }
    } else {
      String currentQuestionId = stateStore.getCurrentQuestionId(sessionId);
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

    if (QuestionType.SINGLE_SELECT == question.questionType() && selectedOptionIds.size() > 1) {
      throw AppException.badRequest("SINGLE_SELECT questions require exactly one selected option");
    }
  }

  private void ensureAnswerMutable(ParticipantAnswer answer) {
    if (answer.isLockedIn() || answer.getFrozenAt() != null) {
      throw AppException.conflict("Answer is already frozen");
    }
  }

  private Set<Long> previousSelectionIds(
      Long sessionId, Long participantId, ParticipantAnswer answer) {
    Set<Long> previousSelectionIds =
        answerStatsStore.getParticipantSelectionIds(
            sessionId, answer.getQuestionId(), participantId);
    if (!previousSelectionIds.isEmpty()) {
      return previousSelectionIds;
    }

    return new LinkedHashSet<>(answer.getSelectedOptionIds());
  }

  private void broadcastAnswerState(Long sessionId, Long questionId) {
    Map<Long, Long> counts = answerStatsStore.getQuestionCounts(sessionId, questionId);
    long totalAnswered = answerStatsStore.getTotalAnswered(sessionId, questionId);
    long totalParticipants = stateStore.getParticipantCount(sessionId);
    long totalLockedIn = answerStatsStore.getTotalLockedIn(sessionId, questionId);

    eventPublisher.publishAnswerUpdate(
        sessionId,
        questionId,
        new AnswerStats(counts, totalAnswered, totalParticipants, totalLockedIn));
  }
}
