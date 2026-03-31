package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.dto.SessionResultsResponse;
import dev.hishaam.hermes.dto.WsPayloads;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.QuestionRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Core transactional engine for session lifecycle operations. Extracted from SessionService to fix
 * Spring's @Transactional proxy self-invocation issue — these methods are now called cross-bean.
 */
@Service
public class SessionEngine {

  private static final Logger log = LoggerFactory.getLogger(SessionEngine.class);

  private final QuizSessionRepository sessionRepository;
  private final QuestionRepository questionRepository;
  private final SessionRedisHelper redisHelper;
  private final StringRedisTemplate redis;
  private final SimpMessagingTemplate messaging;
  private final ThreadPoolTaskScheduler taskScheduler;

  public SessionEngine(
      QuizSessionRepository sessionRepository,
      QuestionRepository questionRepository,
      SessionRedisHelper redisHelper,
      StringRedisTemplate redis,
      SimpMessagingTemplate messaging,
      ThreadPoolTaskScheduler taskScheduler) {
    this.sessionRepository = sessionRepository;
    this.questionRepository = questionRepository;
    this.redisHelper = redisHelper;
    this.redis = redis;
    this.messaging = messaging;
    this.taskScheduler = taskScheduler;
  }

  // ─── Advance to next question (called by timer or organiser) ──────────────────

  @Transactional
  public void advanceSessionInternal(Long sessionId) {
    String sid = sessionId.toString();
    String status = redis.opsForValue().get(redisHelper.key(sid, "status"));
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    QuizSnapshot snapshot = redisHelper.loadSnapshot(sid);
    String currentQIdStr = redis.opsForValue().get(redisHelper.key(sid, "current_question"));
    Long currentQId =
        (currentQIdStr != null && !currentQIdStr.isEmpty()) ? Long.parseLong(currentQIdStr) : null;

    // Broadcast QUESTION_END for current question
    if (currentQId != null) {
      QuizSnapshot.QuestionSnapshot currentQ = snapshot.findQuestion(currentQId);
      if (currentQ != null) {
        Long correctOptionId =
            currentQ.options().stream()
                .filter(QuizSnapshot.OptionSnapshot::isCorrect)
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

    redis.opsForValue().set(redisHelper.key(sid, "current_question"), next.id().toString());
    redisHelper.initQuestionCounts(sid, next);
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
    QuizSnapshot snapshot = redisHelper.loadSnapshot(sessionId.toString());
    doEndSession(sessionId, snapshot);
  }

  @Transactional
  public void doEndSession(Long sessionId, QuizSnapshot snapshot) {
    String sid = sessionId.toString();

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    String joinCode = session.getJoinCode();

    // Skip broadcasting and leaderboard for LOBBY sessions — no participants joined yet
    if (session.getStatus() != SessionStatus.LOBBY) {
      // Build leaderboard from Redis (display names cached there)
      List<SessionResultsResponse.LeaderboardEntry> leaderboard = redisHelper.buildLeaderboard(sid);

      // Broadcast SESSION_END to participants
      messaging.convertAndSend(
          "/topic/session." + sessionId + ".question", new WsPayloads.SessionEnd());

      // Broadcast SESSION_END with leaderboard to organiser
      long participantCount = redisHelper.getParticipantCount(sid);
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
    redisHelper.cleanupSessionKeys(sid, snapshot, joinCode);
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
    redis
        .opsForValue()
        .set(redisHelper.key(sid, "timer"), "1", Duration.ofSeconds(timeLimitSeconds));

    String seqStr = redis.opsForValue().get(redisHelper.key(sid, "question_seq"));
    long seqAtStart = seqStr != null ? Long.parseLong(seqStr) : 0;

    taskScheduler.schedule(
        () -> {
          try {
            String currentSeqStr = redis.opsForValue().get(redisHelper.key(sid, "question_seq"));
            if (currentSeqStr == null) return;
            long currentSeq = Long.parseLong(currentSeqStr);
            if (currentSeq != seqAtStart) return; // stale timer
            advanceSessionInternal(sessionId);
          } catch (Exception e) {
            log.error("Timer error for session {}", sessionId, e);
          }
        },
        Instant.now().plusSeconds(timeLimitSeconds));
  }

  // ─── Leaderboard broadcast (shared with AnswerService) ────────────────────────

  public void broadcastLeaderboardUpdate(Long sessionId, String sid) {
    List<SessionResultsResponse.LeaderboardEntry> leaderboard = redisHelper.buildLeaderboard(sid);
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
      long totalParticipants) {
    messaging.convertAndSend(
        "/topic/session." + sessionId + ".analytics",
        new WsPayloads.AnswerUpdate(questionId, counts, totalAnswered, totalParticipants));
  }
}
