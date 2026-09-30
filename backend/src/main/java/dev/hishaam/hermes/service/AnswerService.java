package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.AnswerRequest;
import dev.hishaam.hermes.dto.session.LockInRequest;
import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.entity.enums.QuestionType;
import dev.hishaam.hermes.entity.enums.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.redis.SessionScoringRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.session.SessionEventPublisher;
import dev.hishaam.hermes.service.session.SessionSnapshotService;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Handles participant answer submission and lock-in during a live session. Validates that the
 * session is in the TIMED lifecycle state, enforces question ownership (passage vs standalone),
 * persists answers to PostgreSQL, updates the live per-question tallies in Redis, and broadcasts
 * them.
 */
@Service
public class AnswerService {

  private final ParticipantAnswerRepository answerRepository;
  private final ParticipantService participantService;
  private final SessionSnapshotService snapshotService;
  private final SessionStateRedisRepository stateStore;
  private final SessionScoringRedisRepository scoringStore;
  private final SessionEventPublisher eventPublisher;

  public AnswerService(
      ParticipantAnswerRepository answerRepository,
      ParticipantService participantService,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionScoringRedisRepository scoringStore,
      SessionEventPublisher eventPublisher) {
    this.answerRepository = answerRepository;
    this.participantService = participantService;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.scoringStore = scoringStore;
    this.eventPublisher = eventPublisher;
  }

  /**
   * Records or replaces a participant's answer for the active question. An empty {@code
   * selectedOptionIds} clears any existing selection. Idempotent — re-submitting the same options
   * leaves the live tallies unchanged.
   */
  @Transactional
  public void submitAnswer(Long sessionId, AnswerRequest request) {
    Long participantId = participantService.resolveParticipantId(request.rejoinToken(), sessionId);

    QuizSnapshot.QuestionSnapshot question =
        requireMutableCurrentQuestion(sessionId, request.questionId());
    Set<Long> selectedOptionIds = normalizeSelectedOptionIds(request.selectedOptionIds());
    validateSelections(question, selectedOptionIds);

    ParticipantAnswer answer =
        answerRepository
            .findForUpdate(participantId, request.questionId())
            .orElseGet(
                () ->
                    ParticipantAnswer.builder()
                        .sessionId(sessionId)
                        .participantId(participantId)
                        .questionId(request.questionId())
                        .build());

    ensureAnswerMutable(answer);

    Set<Long> previousSelectionIds = answer.getSelectedOptionIds();
    answer.setSelectedOptionIds(selectedOptionIds);
    answer.setAnsweredAt(selectedOptionIds.isEmpty() ? null : OffsetDateTime.now());
    answerRepository.save(answer);

    scoringStore.moveSelection(
        sessionId, request.questionId(), participantId, previousSelectionIds, selectedOptionIds);
    broadcastAnswerState(sessionId, question);
  }

  /**
   * Permanently locks a participant's current selection for the active question. A locked-in answer
   * cannot be changed. Requires an existing selection — participants must submit before locking in.
   */
  @Transactional
  public void lockInAnswer(Long sessionId, LockInRequest request) {
    Long participantId = participantService.resolveParticipantId(request.rejoinToken(), sessionId);

    QuizSnapshot.QuestionSnapshot question =
        requireMutableCurrentQuestion(sessionId, request.questionId());

    ParticipantAnswer answer =
        answerRepository
            .findForUpdate(participantId, request.questionId())
            .orElseThrow(() -> AppException.conflict("Cannot lock in before submitting an answer"));

    ensureAnswerMutable(answer);
    if (answer.getSelectedOptionIds().isEmpty()) {
      throw AppException.conflict("Cannot lock in without a selection");
    }

    OffsetDateTime frozenAt = OffsetDateTime.now();
    answer.setLockedIn(true);
    answer.setFrozenAt(frozenAt);
    answerRepository.save(answer);

    scoringStore.markLockedIn(sessionId, request.questionId(), participantId);
    broadcastAnswerState(sessionId, question);
  }

  private QuizSnapshot.QuestionSnapshot requireMutableCurrentQuestion(
      Long sessionId, Long questionId) {
    if (stateStore.getStatus(sessionId) != SessionStatus.ACTIVE) {
      throw AppException.conflict("Session is not accepting answers");
    }

    if (stateStore.getQuestionState(sessionId) != QuestionLifecycleState.TIMED) {
      throw AppException.conflict("Question is not currently accepting answers");
    }

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId);

    // For ENTIRE_PASSAGE mode: accept answers for any sub-question in the current passage
    Long currentPassageId = stateStore.getCurrentPassageId(sessionId);
    if (currentPassageId != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(currentPassageId);
      if (passage == null || !passage.subQuestionIds().contains(questionId)) {
        throw AppException.conflict("Question does not belong to the current passage");
      }
    } else if (!questionId.equals(stateStore.getCurrentQuestionId(sessionId))) {
      throw AppException.conflict("Question is no longer active");
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
    if (!question.optionPoints().keySet().containsAll(selectedOptionIds)) {
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

  private void broadcastAnswerState(Long sessionId, QuizSnapshot.QuestionSnapshot question) {
    eventPublisher.publishAnswerUpdate(
        sessionId,
        question,
        scoringStore.answerStats(
            sessionId, question.id(), stateStore.getParticipantCount(sessionId)));
  }
}
