package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.dto.SessionResultsResponse;
import dev.hishaam.hermes.dto.WsPayloads;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.QuestionRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
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

  public SessionEngine(
      QuizSessionRepository sessionRepository,
      QuestionRepository questionRepository,
      ParticipantAnswerRepository answerRepository,
      SessionSnapshotService snapshotService,
      SessionLiveStateService liveStateService,
      SimpMessagingTemplate messaging,
      SessionTimerScheduler timerScheduler) {
    this.sessionRepository = sessionRepository;
    this.questionRepository = questionRepository;
    this.answerRepository = answerRepository;
    this.snapshotService = snapshotService;
    this.liveStateService = liveStateService;
    this.messaging = messaging;
    this.timerScheduler = timerScheduler;
  }

  // ─── Advance to next question (called by host pressing "Next" from REVIEWING) ─

  @Transactional
  public void advanceSessionInternal(Long sessionId) {
    String sid = sessionId.toString();
    String status = liveStateService.getStatus(sid);
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sid);
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
      if (passage != null && "ENTIRE_PASSAGE".equals(passage.timerMode())) {
        displayEntirePassage(sessionId, sid, passage, snapshot);
        updateDbCurrentQuestion(sessionId, findLastSubQuestion(passage, snapshot));
        return;
      }
    }

    // Regular (standalone or PER_SUB_QUESTION) question display
    liveStateService.setCurrentQuestion(sid, next.id());
    liveStateService.clearCurrentPassage(sid);
    liveStateService.setQuestionState(sid, QuestionLifecycleState.DISPLAYED.name());
    liveStateService.initQuestionCounts(sid, next);
    broadcastQuestionDisplayed(sessionId, next, snapshot);
    updateDbCurrentQuestion(sessionId, next);
  }

  // ─── Start timer (called by host pressing "Start Timer") ──────────────────────

  @Transactional
  public void startTimerInternal(Long sessionId) {
    String sid = sessionId.toString();
    String status = liveStateService.getStatus(sid);
    if (!SessionStatus.ACTIVE.name().equals(status)) {
      throw AppException.conflict("Session is not active");
    }

    String questionState = liveStateService.getQuestionState(sid);
    if (!QuestionLifecycleState.DISPLAYED.name().equals(questionState)) {
      throw AppException.conflict("Timer can only be started when question is in DISPLAYED state");
    }

    // Determine timer target and duration
    String currentPassageIdStr = liveStateService.getCurrentPassageId(sid);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sid);

    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      // ENTIRE_PASSAGE mode — use passage timer
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);
      if (passage == null || passage.timeLimitSeconds() == null) {
        throw AppException.conflict("Passage has no time limit configured");
      }

      liveStateService.setQuestionState(sid, QuestionLifecycleState.TIMED.name());
      liveStateService.setTimer(sid, passage.timeLimitSeconds());

      messaging.convertAndSend(
          "/topic/session." + sessionId + ".question",
          new WsPayloads.TimerStart(null, passageId, passage.timeLimitSeconds()));

      long seqAtStart = liveStateService.getQuestionSequence(sid);
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

      liveStateService.setQuestionState(sid, QuestionLifecycleState.TIMED.name());
      liveStateService.setTimer(sid, question.timeLimitSeconds());

      messaging.convertAndSend(
          "/topic/session." + sessionId + ".question",
          new WsPayloads.TimerStart(questionId, null, question.timeLimitSeconds()));

      long seqAtStart = liveStateService.getQuestionSequence(sid);
      timerScheduler.scheduleQuestionTimer(
          sessionId, questionId, question.timeLimitSeconds(), seqAtStart);
    }
  }

  // ─── Timer expired (called by Quartz job) ─────────────────────────────────────

  @Transactional
  public void onTimerExpired(Long sessionId) {
    String sid = sessionId.toString();
    String status = liveStateService.getStatus(sid);
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    // Only act if still in TIMED state (guard against double-fire)
    String questionState = liveStateService.getQuestionState(sid);
    if (!QuestionLifecycleState.TIMED.name().equals(questionState)) return;

    String currentPassageIdStr = liveStateService.getCurrentPassageId(sid);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sid);

    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      // ENTIRE_PASSAGE mode — freeze all sub-questions
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);

      List<Long> subQuestionIds = passage != null ? passage.subQuestionIds() : List.of();
      subQuestionIds.forEach(
          qid -> answerRepository.freezeAnswersForQuestion(sessionId, qid, OffsetDateTime.now()));

      messaging.convertAndSend(
          "/topic/session." + sessionId + ".question",
          new WsPayloads.PassageFrozen(passageId, subQuestionIds));

    } else {
      // Standalone / PER_SUB_QUESTION question
      if (currentQIdStr != null && !currentQIdStr.isEmpty()) {
        Long questionId = Long.parseLong(currentQIdStr);
        answerRepository.freezeAnswersForQuestion(sessionId, questionId, OffsetDateTime.now());

        messaging.convertAndSend(
            "/topic/session." + sessionId + ".question", new WsPayloads.QuestionFrozen(questionId));
      }
    }

    // Transition to REVIEWING — grading will be added in step 07
    liveStateService.setQuestionState(sid, QuestionLifecycleState.REVIEWING.name());
  }

  // ─── End session ──────────────────────────────────────────────────────────────

  @Transactional
  public void doEndSession(Long sessionId) {
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
    doEndSession(sessionId, snapshot);
  }

  @Transactional
  public void doEndSession(Long sessionId, QuizSnapshot snapshot) {
    String sid = sessionId.toString();
    timerScheduler.cancelQuestionTimer(sessionId);

    // Freeze any outstanding answers
    String currentPassageIdStr = liveStateService.getCurrentPassageId(sid);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sid);
    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      QuizSnapshot.PassageSnapshot passage =
          snapshot.findPassage(Long.parseLong(currentPassageIdStr));
      if (passage != null) {
        passage
            .subQuestionIds()
            .forEach(
                qid ->
                    answerRepository.freezeAnswersForQuestion(
                        sessionId, qid, OffsetDateTime.now()));
      }
    } else if (currentQIdStr != null && !currentQIdStr.isBlank()) {
      answerRepository.freezeAnswersForQuestion(
          sessionId, Long.parseLong(currentQIdStr), OffsetDateTime.now());
    }

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    String joinCode = session.getJoinCode();

    if (session.getStatus() != SessionStatus.LOBBY) {
      List<SessionResultsResponse.LeaderboardEntry> leaderboard =
          liveStateService.buildLeaderboard(sid);

      messaging.convertAndSend(
          "/topic/session." + sessionId + ".question", new WsPayloads.SessionEnd());

      long participantCount = liveStateService.getParticipantCount(sid);
      messaging.convertAndSend(
          "/topic/session." + sessionId + ".analytics",
          new WsPayloads.SessionEndAnalytics(leaderboard, participantCount));
    }

    session.setStatus(SessionStatus.ENDED);
    session.setEndedAt(OffsetDateTime.now());
    session.setCurrentQuestion(null);
    sessionRepository.save(session);

    liveStateService.cleanupSessionKeys(sid, snapshot, joinCode);
  }

  // ─── Question broadcasting ────────────────────────────────────────────────────

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
        "/topic/session." + sessionId + ".question",
        new WsPayloads.QuestionDisplayed(
            question.id(),
            question.text(),
            question.questionType(),
            options,
            questionIndex,
            totalQuestions,
            passageContext));
  }

  // ─── Leaderboard broadcast (shared with AnswerService) ────────────────────────

  public void broadcastLeaderboardUpdate(Long sessionId, String sid) {
    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        liveStateService.buildLeaderboard(sid);
    messaging.convertAndSend(
        "/topic/session." + sessionId + ".analytics",
        new WsPayloads.LeaderboardUpdate(leaderboard));
  }

  // ─── Answer analytics broadcast ───────────────────────────────────────────────

  public void broadcastAnswerUpdate(
      Long sessionId,
      Long questionId,
      Map<Long, Long> counts,
      long totalAnswered,
      long totalParticipants,
      long totalLockedIn) {
    messaging.convertAndSend(
        "/topic/session." + sessionId + ".analytics",
        new WsPayloads.AnswerUpdate(
            questionId, counts, totalAnswered, totalParticipants, totalLockedIn));
  }

  // ─── Passage display helpers ──────────────────────────────────────────────────

  private void displayEntirePassage(
      Long sessionId, String sid, QuizSnapshot.PassageSnapshot passage, QuizSnapshot snapshot) {
    List<QuizSnapshot.QuestionSnapshot> subQuestions =
        passage.subQuestionIds().stream()
            .map(snapshot::findQuestion)
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
            .toList();

    // last sub-question is the "current" pointer so findNextQuestion advances past the passage
    QuizSnapshot.QuestionSnapshot lastSub = subQuestions.get(subQuestions.size() - 1);
    liveStateService.setCurrentQuestion(sid, lastSub.id());
    liveStateService.setCurrentPassage(sid, passage.id());
    liveStateService.setQuestionState(sid, QuestionLifecycleState.DISPLAYED.name());

    subQuestions.forEach(q -> liveStateService.initQuestionCounts(sid, q));

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
                  return new WsPayloads.SubQuestion(q.id(), q.text(), q.questionType(), opts);
                })
            .toList();

    messaging.convertAndSend(
        "/topic/session." + sessionId + ".question",
        new WsPayloads.PassageDisplayed(
            passage.id(), passage.text(), wsSubQuestions, questionIndex, totalQuestions));
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
