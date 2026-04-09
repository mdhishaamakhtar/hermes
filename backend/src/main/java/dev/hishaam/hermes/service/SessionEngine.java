package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.dto.SessionResultsResponse;
import dev.hishaam.hermes.dto.WsPayloads;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.QuestionRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
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

  // ─── Advance to next question (called by timer or organiser) ──────────────────

  @Transactional
  public void advanceSessionInternal(Long sessionId) {
    String sid = sessionId.toString();
    String status = liveStateService.getStatus(sid);
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sid);
    Long currentQId =
        (currentQIdStr != null && !currentQIdStr.isEmpty()) ? Long.parseLong(currentQIdStr) : null;

    // Broadcast QUESTION_END for current question
    if (currentQId != null) {
      answerRepository.freezeAnswersForQuestion(sessionId, currentQId, OffsetDateTime.now());
      QuizSnapshot.QuestionSnapshot currentQ = snapshot.findQuestion(currentQId);
      if (currentQ != null) {
        Long correctOptionId =
            currentQ.options().stream()
                .filter(o -> o.pointValue() > 0)
                .map(QuizSnapshot.OptionSnapshot::id)
                .findFirst()
                .orElse(null);
        messaging.convertAndSend(
            "/topic/session." + sessionId + ".question",
            new WsPayloads.QuestionEnd(currentQId, correctOptionId));
      }
    }

    QuizSnapshot.QuestionSnapshot next = snapshot.findNextQuestion(currentQId);
    if (next == null) {
      doEndSession(sessionId, snapshot);
      return;
    }

    liveStateService.setCurrentQuestion(sid, next.id());
    liveStateService.initQuestionCounts(sid, next);
    broadcastQuestionStart(sessionId, next, snapshot);
    scheduleQuestionTimer(sessionId, next.id(), next.timeLimitSeconds());

    // Update DB current_question pointer using reference to avoid extra SELECT
    sessionRepository
        .findById(sessionId)
        .ifPresent(
            s -> {
              s.setCurrentQuestion(questionRepository.getReferenceById(next.id()));
              sessionRepository.save(s);
            });
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
    String currentQuestionId = liveStateService.getCurrentQuestionId(sid);
    if (currentQuestionId != null && !currentQuestionId.isBlank()) {
      answerRepository.freezeAnswersForQuestion(
          sessionId, Long.parseLong(currentQuestionId), OffsetDateTime.now());
    }

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    String joinCode = session.getJoinCode();

    // Skip broadcasting and leaderboard for LOBBY sessions — no participants joined yet
    if (session.getStatus() != SessionStatus.LOBBY) {
      // Build leaderboard from Redis (display names cached there)
      List<SessionResultsResponse.LeaderboardEntry> leaderboard = liveStateService.buildLeaderboard(sid);

      // Broadcast SESSION_END to participants
      messaging.convertAndSend(
          "/topic/session." + sessionId + ".question", new WsPayloads.SessionEnd());

      // Broadcast SESSION_END with leaderboard to organiser
      long participantCount = liveStateService.getParticipantCount(sid);
      messaging.convertAndSend(
          "/topic/session." + sessionId + ".analytics",
          new WsPayloads.SessionEndAnalytics(leaderboard, participantCount));
    }

    // Update DB
    session.setStatus(SessionStatus.ENDED);
    session.setEndedAt(OffsetDateTime.now());
    session.setCurrentQuestion(null);
    sessionRepository.save(session);

    // Clean up Redis — pass snapshot directly (no redundant DB load)
    liveStateService.cleanupSessionKeys(sid, snapshot, joinCode);
  }

  // ─── Question broadcasting ────────────────────────────────────────────────────

  void broadcastQuestionStart(
      Long sessionId, QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    int questionIndex = snapshot.questionPosition(question.id());
    int totalQuestions = snapshot.questions().size();

    List<WsPayloads.Option> options =
        question.options().stream()
            .map(o -> new WsPayloads.Option(o.id(), o.text(), o.orderIndex()))
            .toList();

    messaging.convertAndSend(
        "/topic/session." + sessionId + ".question",
        new WsPayloads.QuestionStart(
            question.id(),
            question.text(),
            options,
            question.timeLimitSeconds(),
            questionIndex,
            totalQuestions));
  }

  // ─── Timer scheduling ─────────────────────────────────────────────────────────

  void scheduleQuestionTimer(Long sessionId, Long questionId, int timeLimitSeconds) {
    String sid = sessionId.toString();
    liveStateService.setTimer(sid, timeLimitSeconds);
    long seqAtStart = liveStateService.getQuestionSequence(sid);
    timerScheduler.scheduleQuestionTimer(sessionId, questionId, timeLimitSeconds, seqAtStart);
  }

  // ─── Leaderboard broadcast (shared with AnswerService) ────────────────────────

  public void broadcastLeaderboardUpdate(Long sessionId, String sid) {
    List<SessionResultsResponse.LeaderboardEntry> leaderboard = liveStateService.buildLeaderboard(sid);
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
}
