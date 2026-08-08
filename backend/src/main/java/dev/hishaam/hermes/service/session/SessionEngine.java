package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.entity.enums.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.redis.SessionScoringRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.GradingService;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transactional state machine for a live session: question display and advancement, timer start and
 * expiry, and session end. Methods here perform no auth checks — callers ({@link SessionService},
 * {@code SessionTimeoutJob}) authorize first and invoke cross-bean so {@code @Transactional}
 * applies.
 */
@Service
public class SessionEngine {

  private final QuizSessionRepository sessionRepository;
  private final ParticipantAnswerRepository answerRepository;
  private final SessionSnapshotService snapshotService;
  private final SessionStateRedisRepository stateStore;
  private final SessionScoringRedisRepository scoringStore;
  private final SessionEventPublisher eventPublisher;
  private final SessionTimerScheduler timerScheduler;
  private final GradingService gradingService;

  public SessionEngine(
      QuizSessionRepository sessionRepository,
      ParticipantAnswerRepository answerRepository,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionScoringRedisRepository scoringStore,
      SessionEventPublisher eventPublisher,
      SessionTimerScheduler timerScheduler,
      GradingService gradingService) {
    this.sessionRepository = sessionRepository;
    this.answerRepository = answerRepository;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.scoringStore = scoringStore;
    this.eventPublisher = eventPublisher;
    this.timerScheduler = timerScheduler;
    this.gradingService = gradingService;
  }

  // ─── Question advancement ──────────────────────────────────────────────────────

  /**
   * Advances the session to the next question (or ends the session if no more questions remain).
   * Handles ENTIRE_PASSAGE passages by displaying all sub-questions together. No-ops if the session
   * is no longer ACTIVE (guards against late-firing Quartz jobs and race conditions).
   */
  @Transactional
  public void advanceSessionInternal(Long sessionId) {
    if (stateStore.getStatus(sessionId) != SessionStatus.ACTIVE) return;

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
    QuizSnapshot.QuestionSnapshot next =
        snapshot.findNextQuestion(stateStore.getCurrentQuestionId(sessionId));
    if (next == null) {
      doEndSession(sessionId, snapshot);
      return;
    }

    if (next.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(next.passageId());
      if (passage != null && PassageTimerMode.ENTIRE_PASSAGE == passage.timerMode()) {
        displayEntirePassage(sessionId, passage, snapshot);
        updateDbCurrentQuestion(sessionId, findLastSubQuestion(passage, snapshot));
        return;
      }
    }

    stateStore.setCurrentQuestion(sessionId, next.id());
    stateStore.clearCurrentPassage(sessionId);
    stateStore.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED);
    scoringStore.initQuestionCounts(sessionId, next);
    eventPublisher.publishQuestionDisplayed(sessionId, next, snapshot);
    updateDbCurrentQuestion(sessionId, next);
  }

  // ─── Timer start / expiry ──────────────────────────────────────────────────────

  /**
   * Starts the countdown timer for the current question or ENTIRE_PASSAGE block. Transitions the
   * question lifecycle from DISPLAYED to TIMED, records the timer start epoch for answer-time
   * ranking, and schedules a Quartz job to fire {@link #onTimerExpired} when time runs out.
   */
  @Transactional
  public void startTimerInternal(Long sessionId) {
    if (stateStore.getStatus(sessionId) != SessionStatus.ACTIVE) {
      throw AppException.conflict("Session is not active");
    }
    if (stateStore.getQuestionState(sessionId) != QuestionLifecycleState.DISPLAYED) {
      throw AppException.conflict("Timer can only be started when question is in DISPLAYED state");
    }

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
    CurrentTarget target = resolveCurrentTarget(sessionId, snapshot);
    if (target == null) {
      throw AppException.conflict("No current question to start timer for");
    }

    // Only a passage can reach here without a limit, and creation validation already rejects that;
    // the guard exists so a corrupted snapshot fails as a conflict rather than an unboxing NPE.
    Integer timeLimit = target.timeLimitSeconds();
    if (timeLimit == null) {
      throw AppException.conflict("Current question or passage has no time limit configured");
    }

    stateStore.setQuestionState(sessionId, QuestionLifecycleState.TIMED);
    stateStore.setTimer(sessionId, timeLimit);
    stateStore.recordTimerStartedAt(sessionId, Instant.now().toEpochMilli());
    switch (target) {
      case CurrentTarget.Passage p ->
          eventPublisher.publishTimerStart(sessionId, null, p.passage().id(), timeLimit);
      case CurrentTarget.Question q ->
          eventPublisher.publishTimerStart(sessionId, q.question().id(), null, timeLimit);
    }
    timerScheduler.scheduleQuestionTimer(
        sessionId, timeLimit, stateStore.getQuestionSequence(sessionId));
  }

  /**
   * Handles timer expiry: freezes all unfrozen answers, grades the question or passage, and
   * transitions the lifecycle to REVIEWING. No-ops if the session is not ACTIVE or the question is
   * not in the TIMED state (guards against stale Quartz job firings).
   */
  @Transactional
  public void onTimerExpired(Long sessionId) {
    if (stateStore.getStatus(sessionId) != SessionStatus.ACTIVE) return;
    if (stateStore.getQuestionState(sessionId) != QuestionLifecycleState.TIMED) return;

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
    CurrentTarget target = resolveCurrentTarget(sessionId, snapshot);
    if (target != null) {
      freezeAnswers(sessionId, target);
      switch (target) {
        case CurrentTarget.Passage p -> {
          eventPublisher.publishPassageFrozen(sessionId, p.passage().id(), p.questionIds());
          gradingService.gradePassage(sessionId, p.passage().id());
        }
        case CurrentTarget.Question q -> {
          eventPublisher.publishQuestionFrozen(sessionId, q.question().id());
          gradingService.gradeQuestion(sessionId, q.question().id());
        }
      }
    }

    stateStore.setQuestionState(sessionId, QuestionLifecycleState.REVIEWING);
  }

  // ─── Session end ───────────────────────────────────────────────────────────────

  /**
   * Ends the session, loading the snapshot internally. Convenience overload for callers that don't
   * already hold the snapshot.
   */
  @Transactional
  public void doEndSession(Long sessionId) {
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
    doEndSession(sessionId, snapshot);
  }

  /**
   * Ends the session: cancels any pending timer, freezes and grades the in-progress question if
   * needed, persists ENDED status with the end timestamp, broadcasts SESSION_END to participants,
   * and cleans up all Redis keys for the session.
   */
  @Transactional
  public void doEndSession(Long sessionId, QuizSnapshot snapshot) {
    timerScheduler.cancelQuestionTimer(sessionId);

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    String joinCode = session.getJoinCode();

    boolean timedInRedis = stateStore.getQuestionState(sessionId) == QuestionLifecycleState.TIMED;
    CurrentTarget target = resolveCurrentTarget(sessionId, snapshot);
    if (target == null) {
      // Redis lost the live pointers; the session row still records the question in progress.
      target = targetFromPersistedQuestion(session, snapshot);
    }

    if (target != null) {
      freezeAnswers(sessionId, target);
      // The lifecycle flag lives in Redis too, so an eviction loses the signal to grade. Fall back
      // to the durable record: anything submitted and never graded still needs scoring.
      // The lifecycle flag lives in Redis too, so an eviction loses the signal to grade. Fall back
      // to the durable record: anything submitted and never graded still needs scoring. An
      // already-graded answer carries a gradedAt stamp, so this cannot double-grade.
      boolean shouldGrade =
          timedInRedis
              || answerRepository.countUngradedAnswers(sessionId, target.questionIds()) > 0;
      if (shouldGrade) {
        switch (target) {
          case CurrentTarget.Passage p -> gradingService.gradePassage(sessionId, p.passage().id());
          case CurrentTarget.Question q ->
              gradingService.gradeQuestion(sessionId, q.question().id());
        }
      }
    }

    if (session.getStatus() != SessionStatus.LOBBY) {
      eventPublisher.publishSessionEnd(sessionId);
      eventPublisher.publishSessionEndAnalytics(sessionId);
    }

    session.setStatus(SessionStatus.ENDED);
    session.setEndedAt(OffsetDateTime.now());
    session.setCurrentQuestionId(null);
    sessionRepository.save(session);

    stateStore.cleanupSessionKeys(sessionId, joinCode);
    scoringStore.cleanupScoringKeys(sessionId, snapshot);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────────

  /**
   * Resolves what the session is currently sitting on. An active ENTIRE_PASSAGE block takes
   * precedence over the current question, since the current-question key points at the passage's
   * last sub-question while the block is displayed. Returns null when nothing is current — which
   * happens when live state has been evicted, or before the session has started.
   */
  private CurrentTarget resolveCurrentTarget(Long sessionId, QuizSnapshot snapshot) {
    Long passageId = stateStore.getCurrentPassageId(sessionId);
    if (passageId != null) {
      return new CurrentTarget.Passage(snapshot.requirePassage(passageId));
    }

    Long questionId = stateStore.getCurrentQuestionId(sessionId);
    return questionId == null
        ? null
        : new CurrentTarget.Question(snapshot.requireQuestion(questionId));
  }

  /**
   * Rebuilds the current target from the session row when Redis no longer has the live pointers.
   * The row stores the last displayed question; if that question sits inside an ENTIRE_PASSAGE
   * block the whole block is the unit that was on screen, so the block is returned instead.
   */
  private CurrentTarget targetFromPersistedQuestion(QuizSession session, QuizSnapshot snapshot) {
    Long questionId = session.getCurrentQuestionId();
    if (questionId == null) return null;

    QuizSnapshot.QuestionSnapshot question = snapshot.requireQuestion(questionId);
    if (question.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.requirePassage(question.passageId());
      if (PassageTimerMode.ENTIRE_PASSAGE == passage.timerMode()) {
        return new CurrentTarget.Passage(passage);
      }
    }
    return new CurrentTarget.Question(question);
  }

  private void freezeAnswers(Long sessionId, CurrentTarget target) {
    OffsetDateTime frozenAt = OffsetDateTime.now();
    target
        .questionIds()
        .forEach(qid -> answerRepository.freezeAnswersForQuestion(sessionId, qid, frozenAt));
  }

  private void displayEntirePassage(
      Long sessionId, QuizSnapshot.PassageSnapshot passage, QuizSnapshot snapshot) {
    List<QuizSnapshot.QuestionSnapshot> subQuestions = snapshot.subQuestionsOf(passage);
    QuizSnapshot.QuestionSnapshot lastSub = subQuestions.getLast();
    stateStore.setCurrentQuestion(sessionId, lastSub.id());
    stateStore.setCurrentPassage(sessionId, passage.id());
    stateStore.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED);
    subQuestions.forEach(q -> scoringStore.initQuestionCounts(sessionId, q));
    eventPublisher.publishPassageDisplayed(sessionId, passage, subQuestions, snapshot);
  }

  private QuizSnapshot.QuestionSnapshot findLastSubQuestion(
      QuizSnapshot.PassageSnapshot passage, QuizSnapshot snapshot) {
    // A passage only becomes current because one of its sub-questions was next in the ordering,
    // so the list is never empty here.
    return snapshot.subQuestionsOf(passage).getLast();
  }

  private void updateDbCurrentQuestion(Long sessionId, QuizSnapshot.QuestionSnapshot question) {
    sessionRepository
        .findById(sessionId)
        .ifPresent(
            s -> {
              s.setCurrentQuestionId(question.id());
              sessionRepository.save(s);
            });
  }
}
