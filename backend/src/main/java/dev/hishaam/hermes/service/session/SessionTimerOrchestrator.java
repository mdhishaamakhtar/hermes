package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionTimerRedisRepository;
import dev.hishaam.hermes.service.*;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Handles timer start and expiry for a session. Extracted from {@link SessionEngine} to separate
 * timer orchestration from session lifecycle advancement.
 */
@Service
public class SessionTimerOrchestrator {

  private final SessionStateRedisRepository stateStore;
  private final SessionTimerRedisRepository timerStore;
  private final SessionSnapshotService snapshotService;
  private final SessionEventPublisher eventPublisher;
  private final SessionTimerScheduler timerScheduler;
  private final GradingService gradingService;
  private final ParticipantAnswerRepository answerRepository;

  public SessionTimerOrchestrator(
      SessionStateRedisRepository stateStore,
      SessionTimerRedisRepository timerStore,
      SessionSnapshotService snapshotService,
      SessionEventPublisher eventPublisher,
      SessionTimerScheduler timerScheduler,
      GradingService gradingService,
      ParticipantAnswerRepository answerRepository) {
    this.stateStore = stateStore;
    this.timerStore = timerStore;
    this.snapshotService = snapshotService;
    this.eventPublisher = eventPublisher;
    this.timerScheduler = timerScheduler;
    this.gradingService = gradingService;
    this.answerRepository = answerRepository;
  }

  @Transactional
  public void startTimerInternal(Long sessionId) {
    String sid = sessionId.toString();
    String status = stateStore.getStatus(sessionId);
    if (!SessionStatus.ACTIVE.name().equals(status)) {
      throw AppException.conflict("Session is not active");
    }

    String questionState = stateStore.getQuestionState(sessionId);
    if (!QuestionLifecycleState.DISPLAYED.name().equals(questionState)) {
      throw AppException.conflict("Timer can only be started when question is in DISPLAYED state");
    }

    String currentPassageIdStr = stateStore.getCurrentPassageId(sessionId);
    String currentQIdStr = stateStore.getCurrentQuestionId(sessionId);

    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);
      if (passage == null || passage.timeLimitSeconds() == null) {
        throw AppException.conflict("Passage has no time limit configured");
      }

      stateStore.setQuestionState(sessionId, QuestionLifecycleState.TIMED.name());
      timerStore.setTimer(sessionId, passage.timeLimitSeconds());
      timerStore.recordTimerStartedAt(sessionId, Instant.now().toEpochMilli());
      eventPublisher.publishTimerStart(sessionId, null, passageId, passage.timeLimitSeconds());

      long seqAtStart = timerStore.getQuestionSequence(sessionId);
      Long anchorQuestionId = Long.parseLong(currentQIdStr);
      timerScheduler.scheduleQuestionTimer(
          sessionId, anchorQuestionId, passage.timeLimitSeconds(), seqAtStart);

    } else {
      if (currentQIdStr == null || currentQIdStr.isEmpty()) {
        throw AppException.conflict("No current question to start timer for");
      }
      Long questionId = Long.parseLong(currentQIdStr);
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
      QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
      if (question == null) {
        throw AppException.notFound("Question not found in session snapshot");
      }

      stateStore.setQuestionState(sessionId, QuestionLifecycleState.TIMED.name());
      timerStore.setTimer(sessionId, question.timeLimitSeconds());
      timerStore.recordTimerStartedAt(sessionId, Instant.now().toEpochMilli());
      eventPublisher.publishTimerStart(sessionId, questionId, null, question.timeLimitSeconds());

      long seqAtStart = timerStore.getQuestionSequence(sessionId);
      timerScheduler.scheduleQuestionTimer(
          sessionId, questionId, question.timeLimitSeconds(), seqAtStart);
    }
  }

  @Transactional
  public void onTimerExpired(Long sessionId) {
    String sid = sessionId.toString();
    String status = stateStore.getStatus(sessionId);
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    String questionState = stateStore.getQuestionState(sessionId);
    if (!QuestionLifecycleState.TIMED.name().equals(questionState)) return;

    String currentPassageIdStr = stateStore.getCurrentPassageId(sessionId);
    String currentQIdStr = stateStore.getCurrentQuestionId(sessionId);

    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);

      List<Long> subQuestionIds = passage != null ? passage.subQuestionIds() : List.of();
      subQuestionIds.forEach(
          qid -> answerRepository.freezeAnswersForQuestion(sessionId, qid, OffsetDateTime.now()));

      eventPublisher.publishPassageFrozen(sessionId, passageId, subQuestionIds);
      gradingService.gradePassage(sessionId, passageId);

    } else {
      if (currentQIdStr != null && !currentQIdStr.isEmpty()) {
        Long questionId = Long.parseLong(currentQIdStr);
        answerRepository.freezeAnswersForQuestion(sessionId, questionId, OffsetDateTime.now());
        eventPublisher.publishQuestionFrozen(sessionId, questionId);
        gradingService.gradeQuestion(sessionId, questionId);
      }
    }

    stateStore.setQuestionState(sessionId, QuestionLifecycleState.REVIEWING.name());
  }
}
