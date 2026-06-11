package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.redis.SessionScoringRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.GradingService;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
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
    String sid = sessionId.toString();
    String status = stateStore.getStatus(sessionId);
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    String currentQIdStr = stateStore.getCurrentQuestionId(sessionId);
    Long currentQId =
        (currentQIdStr != null && !currentQIdStr.isEmpty()) ? Long.parseLong(currentQIdStr) : null;

    QuizSnapshot.QuestionSnapshot next = snapshot.findNextQuestion(currentQId);
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
    stateStore.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED.name());
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
      stateStore.setTimer(sessionId, passage.timeLimitSeconds());
      stateStore.recordTimerStartedAt(sessionId, Instant.now().toEpochMilli());
      eventPublisher.publishTimerStart(sessionId, null, passageId, passage.timeLimitSeconds());

      long seqAtStart = stateStore.getQuestionSequence(sessionId);
      timerScheduler.scheduleQuestionTimer(sessionId, passage.timeLimitSeconds(), seqAtStart);

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
      stateStore.setTimer(sessionId, question.timeLimitSeconds());
      stateStore.recordTimerStartedAt(sessionId, Instant.now().toEpochMilli());
      eventPublisher.publishTimerStart(sessionId, questionId, null, question.timeLimitSeconds());

      long seqAtStart = stateStore.getQuestionSequence(sessionId);
      timerScheduler.scheduleQuestionTimer(sessionId, question.timeLimitSeconds(), seqAtStart);
    }
  }

  /**
   * Handles timer expiry: freezes all unfrozen answers, grades the question or passage, and
   * transitions the lifecycle to REVIEWING. No-ops if the session is not ACTIVE or the question is
   * not in the TIMED state (guards against stale Quartz job firings).
   */
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

    String currentPassageIdStr = stateStore.getCurrentPassageId(sessionId);
    String currentQIdStr = stateStore.getCurrentQuestionId(sessionId);
    String qState = stateStore.getQuestionState(sessionId);
    boolean shouldGrade = QuestionLifecycleState.TIMED.name().equals(qState);

    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);
      if (passage != null) {
        passage
            .subQuestionIds()
            .forEach(
                qid ->
                    answerRepository.freezeAnswersForQuestion(
                        sessionId, qid, OffsetDateTime.now()));
        if (shouldGrade) {
          gradingService.gradePassage(sessionId, passageId);
        }
      }
    } else if (currentQIdStr != null && !currentQIdStr.isBlank()) {
      Long questionId = Long.parseLong(currentQIdStr);
      answerRepository.freezeAnswersForQuestion(sessionId, questionId, OffsetDateTime.now());
      if (shouldGrade) {
        gradingService.gradeQuestion(sessionId, questionId);
      }
    }

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    String joinCode = session.getJoinCode();

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

  private void displayEntirePassage(
      Long sessionId, QuizSnapshot.PassageSnapshot passage, QuizSnapshot snapshot) {
    List<QuizSnapshot.QuestionSnapshot> subQuestions =
        passage.subQuestionIds().stream()
            .map(snapshot::findQuestion)
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
            .toList();

    QuizSnapshot.QuestionSnapshot lastSub = subQuestions.getLast();
    stateStore.setCurrentQuestion(sessionId, lastSub.id());
    stateStore.setCurrentPassage(sessionId, passage.id());
    stateStore.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED.name());
    subQuestions.forEach(q -> scoringStore.initQuestionCounts(sessionId, q));
    eventPublisher.publishPassageDisplayed(sessionId, passage, subQuestions, snapshot);
  }

  private QuizSnapshot.QuestionSnapshot findLastSubQuestion(
      QuizSnapshot.PassageSnapshot passage, QuizSnapshot snapshot) {
    return passage.subQuestionIds().stream()
        .map(snapshot::findQuestion)
        .filter(Objects::nonNull)
        .max(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
        .orElseThrow(() -> AppException.badRequest("Passage has no sub-questions"));
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
