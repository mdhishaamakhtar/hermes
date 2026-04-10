package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.AnswerStats;
import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.dto.SessionResultsResponse;
import dev.hishaam.hermes.dto.WsPayloads;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.QuestionRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.util.WsTopics;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Core transactional engine for session lifecycle operations. Extracted from SessionService to fix
 * Spring's @Transactional proxy self-invocation issue — these methods are now called cross-bean.
 */
@Service
public class SessionEngine {

  private final QuizSessionRepository sessionRepository;
  private final QuestionRepository questionRepository;
  private final ParticipantAnswerRepository answerRepository;
  private final SessionSnapshotService snapshotService;
  private final SessionLiveStateService liveStateService;
  private final SimpMessagingTemplate messaging;
  private final SessionTimerScheduler timerScheduler;
  private final GradingService gradingService;

  public SessionEngine(
      QuizSessionRepository sessionRepository,
      QuestionRepository questionRepository,
      ParticipantAnswerRepository answerRepository,
      SessionSnapshotService snapshotService,
      SessionLiveStateService liveStateService,
      SimpMessagingTemplate messaging,
      SessionTimerScheduler timerScheduler,
      GradingService gradingService) {
    this.sessionRepository = sessionRepository;
    this.questionRepository = questionRepository;
    this.answerRepository = answerRepository;
    this.snapshotService = snapshotService;
    this.liveStateService = liveStateService;
    this.messaging = messaging;
    this.timerScheduler = timerScheduler;
    this.gradingService = gradingService;
  }

  @Transactional
  public void advanceSessionInternal(Long sessionId) {
    String sid = sessionId.toString();
    String status = liveStateService.getStatus(sessionId);
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sessionId);
    Long currentQId =
        (currentQIdStr != null && !currentQIdStr.isEmpty()) ? Long.parseLong(currentQIdStr) : null;

    QuizSnapshot.QuestionSnapshot next = snapshot.findNextQuestion(currentQId);
    if (next == null) {
      doEndSession(sessionId, snapshot);
      return;
    }

    // Check if the next question belongs to an ENTIRE_PASSAGE passage
    if (next.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(next.passageId());
      if (passage != null && PassageTimerMode.ENTIRE_PASSAGE == passage.timerMode()) {
        displayEntirePassage(sessionId, passage, snapshot);
        updateDbCurrentQuestion(sessionId, findLastSubQuestion(passage, snapshot));
        return;
      }
    }

    // Regular (standalone or PER_SUB_QUESTION) question display
    liveStateService.setCurrentQuestion(sessionId, next.id());
    liveStateService.clearCurrentPassage(sessionId);
    liveStateService.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED.name());
    liveStateService.initQuestionCounts(sessionId, next);
    broadcastQuestionDisplayed(sessionId, next, snapshot);
    updateDbCurrentQuestion(sessionId, next);
  }

  @Transactional
  public void startTimerInternal(Long sessionId) {
    String sid = sessionId.toString();
    String status = liveStateService.getStatus(sessionId);
    if (!SessionStatus.ACTIVE.name().equals(status)) {
      throw AppException.conflict("Session is not active");
    }

    String questionState = liveStateService.getQuestionState(sessionId);
    if (!QuestionLifecycleState.DISPLAYED.name().equals(questionState)) {
      throw AppException.conflict("Timer can only be started when question is in DISPLAYED state");
    }

    // Determine timer target and duration
    String currentPassageIdStr = liveStateService.getCurrentPassageId(sessionId);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sessionId);

    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      // ENTIRE_PASSAGE mode — use passage timer
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);
      if (passage == null || passage.timeLimitSeconds() == null) {
        throw AppException.conflict("Passage has no time limit configured");
      }

      liveStateService.setQuestionState(sessionId, QuestionLifecycleState.TIMED.name());
      liveStateService.setTimer(sessionId, passage.timeLimitSeconds());
      liveStateService.recordTimerStartedAt(sessionId, Instant.now().toEpochMilli());

      messaging.convertAndSend(
          WsTopics.sessionQuestion(sessionId),
          new WsPayloads.TimerStart(null, passageId, passage.timeLimitSeconds()));

      long seqAtStart = liveStateService.getQuestionSequence(sessionId);
      Long anchorQuestionId = Long.parseLong(currentQIdStr);
      timerScheduler.scheduleQuestionTimer(
          sessionId, anchorQuestionId, passage.timeLimitSeconds(), seqAtStart);

    } else {
      // Standalone or PER_SUB_QUESTION question
      if (currentQIdStr == null || currentQIdStr.isEmpty()) {
        throw AppException.conflict("No current question to start timer for");
      }
      Long questionId = Long.parseLong(currentQIdStr);
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
      QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
      if (question == null) {
        throw AppException.notFound("Question not found in session snapshot");
      }

      liveStateService.setQuestionState(sessionId, QuestionLifecycleState.TIMED.name());
      liveStateService.setTimer(sessionId, question.timeLimitSeconds());
      liveStateService.recordTimerStartedAt(sessionId, Instant.now().toEpochMilli());

      messaging.convertAndSend(
          WsTopics.sessionQuestion(sessionId),
          new WsPayloads.TimerStart(questionId, null, question.timeLimitSeconds()));

      long seqAtStart = liveStateService.getQuestionSequence(sessionId);
      timerScheduler.scheduleQuestionTimer(
          sessionId, questionId, question.timeLimitSeconds(), seqAtStart);
    }
  }

  @Transactional
  public void onTimerExpired(Long sessionId) {
    String sid = sessionId.toString();
    String status = liveStateService.getStatus(sessionId);
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    // Only act if still in TIMED state (guard against double-fire)
    String questionState = liveStateService.getQuestionState(sessionId);
    if (!QuestionLifecycleState.TIMED.name().equals(questionState)) return;

    String currentPassageIdStr = liveStateService.getCurrentPassageId(sessionId);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sessionId);

    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      // ENTIRE_PASSAGE mode — freeze all sub-questions, then grade passage
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);

      List<Long> subQuestionIds = passage != null ? passage.subQuestionIds() : List.of();
      subQuestionIds.forEach(
          qid -> answerRepository.freezeAnswersForQuestion(sessionId, qid, OffsetDateTime.now()));

      messaging.convertAndSend(
          WsTopics.sessionQuestion(sessionId),
          new WsPayloads.PassageFrozen(passageId, subQuestionIds));

      gradingService.gradePassage(sessionId, passageId);

    } else {
      // Standalone / PER_SUB_QUESTION question
      if (currentQIdStr != null && !currentQIdStr.isEmpty()) {
        Long questionId = Long.parseLong(currentQIdStr);
        answerRepository.freezeAnswersForQuestion(sessionId, questionId, OffsetDateTime.now());

        messaging.convertAndSend(
            WsTopics.sessionQuestion(sessionId), new WsPayloads.QuestionFrozen(questionId));

        gradingService.gradeQuestion(sessionId, questionId);
      }
    }

    liveStateService.setQuestionState(sessionId, QuestionLifecycleState.REVIEWING.name());
  }

  @Transactional
  public void doEndSession(Long sessionId) {
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
    doEndSession(sessionId, snapshot);
  }

  @Transactional
  public void doEndSession(Long sessionId, QuizSnapshot snapshot) {
    String sid = sessionId.toString();
    timerScheduler.cancelQuestionTimer(sessionId);

    // Freeze and GRADE any outstanding answers before ending
    String currentPassageIdStr = liveStateService.getCurrentPassageId(sessionId);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sessionId);
    String qState = liveStateService.getQuestionState(sessionId);
    boolean shouldGrade =
        QuestionLifecycleState.TIMED.name().equals(qState)
            || QuestionLifecycleState.FROZEN.name().equals(qState);

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
      List<SessionResultsResponse.LeaderboardEntry> leaderboard =
          liveStateService.buildLeaderboard(sessionId);

      messaging.convertAndSend(WsTopics.sessionQuestion(sessionId), new WsPayloads.SessionEnd());

      long participantCount = liveStateService.getParticipantCount(sessionId);
      messaging.convertAndSend(
          WsTopics.sessionAnalytics(sessionId),
          new WsPayloads.SessionEndAnalytics(leaderboard, participantCount));
    }

    session.setStatus(SessionStatus.ENDED);
    session.setEndedAt(OffsetDateTime.now());
    session.setCurrentQuestion(null);
    sessionRepository.save(session);

    liveStateService.cleanupSessionKeys(sessionId, snapshot, joinCode);
  }

  public void broadcastQuestionDisplayed(
      Long sessionId, QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    int questionIndex = snapshot.questionPosition(question.id());
    int totalQuestions = snapshot.questions().size();

    List<WsPayloads.Option> options =
        question.options().stream()
            .map(o -> new WsPayloads.Option(o.id(), o.text(), o.orderIndex()))
            .toList();

    // Include passage context for PER_SUB_QUESTION sub-questions
    WsPayloads.PassageContext passageContext = null;
    if (question.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(question.passageId());
      if (passage != null) {
        passageContext = new WsPayloads.PassageContext(passage.id(), passage.text());
      }
    }

    messaging.convertAndSend(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.QuestionDisplayed(
            question.id(),
            question.text(),
            question.questionType().name(),
            options,
            questionIndex,
            totalQuestions,
            passageContext,
            question.effectiveDisplayMode().name()));
  }

  public void broadcastLeaderboardUpdate(Long sessionId) {
    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        liveStateService.buildLeaderboard(sessionId);
    messaging.convertAndSend(
        WsTopics.sessionAnalytics(sessionId), new WsPayloads.LeaderboardUpdate(leaderboard));
  }

  public void broadcastAnswerUpdate(Long sessionId, Long questionId, AnswerStats stats) {
    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
    DisplayMode mode = question != null ? question.effectiveDisplayMode() : DisplayMode.LIVE;

    if (mode == DisplayMode.CODE_DISPLAY) {
      // Suppress entirely during TIMED state
      return;
    }

    Map<Long, Long> broadcastCounts = mode == DisplayMode.BLIND ? Map.of() : stats.optionCounts();
    var answerUpdate =
        new WsPayloads.AnswerUpdate(
            questionId,
            broadcastCounts,
            stats.totalAnswered(),
            stats.totalParticipants(),
            stats.totalLockedIn());
    messaging.convertAndSend(WsTopics.sessionAnalytics(sessionId), answerUpdate);
    // Also broadcast to .question so participants (unauthenticated) can receive live counts
    messaging.convertAndSend(WsTopics.sessionQuestion(sessionId), answerUpdate);
  }

  private void displayEntirePassage(
      Long sessionId, QuizSnapshot.PassageSnapshot passage, QuizSnapshot snapshot) {
    List<QuizSnapshot.QuestionSnapshot> subQuestions =
        passage.subQuestionIds().stream()
            .map(snapshot::findQuestion)
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
            .toList();

    // last sub-question is the "current" pointer so findNextQuestion advances past the passage
    QuizSnapshot.QuestionSnapshot lastSub = subQuestions.get(subQuestions.size() - 1);
    liveStateService.setCurrentQuestion(sessionId, lastSub.id());
    liveStateService.setCurrentPassage(sessionId, passage.id());
    liveStateService.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED.name());

    subQuestions.forEach(q -> liveStateService.initQuestionCounts(sessionId, q));

    int questionIndex = snapshot.questionPosition(subQuestions.get(0).id());
    int totalQuestions = snapshot.questions().size();

    List<WsPayloads.SubQuestion> wsSubQuestions =
        subQuestions.stream()
            .map(
                q -> {
                  List<WsPayloads.Option> opts =
                      q.options().stream()
                          .map(o -> new WsPayloads.Option(o.id(), o.text(), o.orderIndex()))
                          .toList();
                  return new WsPayloads.SubQuestion(q.id(), q.text(), q.questionType().name(), opts);
                })
            .toList();

    // Use the first sub-question's effective display mode for the passage (sub-questions share
    // mode)
    String effectiveDisplayMode =
        subQuestions.isEmpty()
            ? DisplayMode.LIVE.name()
            : subQuestions.get(0).effectiveDisplayMode().name();

    messaging.convertAndSend(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.PassageDisplayed(
            passage.id(),
            passage.text(),
            passage.timeLimitSeconds(),
            wsSubQuestions,
            questionIndex,
            totalQuestions,
            effectiveDisplayMode));
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
              s.setCurrentQuestion(questionRepository.getReferenceById(question.id()));
              sessionRepository.save(s);
            });
  }
}
