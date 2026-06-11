package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.util.SessionRedisKeys;
import java.time.Duration;
import java.util.List;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisStringCommands;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.stereotype.Repository;

/**
 * Live session state in Redis: status, current question/passage, question lifecycle state,
 * participant tracking, the countdown timer and question sequence, the quiz snapshot JSON, and
 * join-code reservations. Everything here shares the session TTL and is cleaned up together via
 * {@link #cleanupSessionKeys}. Scoring data (answer stats, leaderboard) lives in {@link
 * SessionScoringRedisRepository}.
 */
@Repository
public class SessionStateRedisRepository {

  private final StringRedisTemplate redis;

  public SessionStateRedisRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

  /** Volatile state needed to rebuild a client's live view after reconnect. */
  public record RejoinContext(
      String questionLifecycle,
      Long currentQuestionId,
      Long currentPassageId,
      int participantCount,
      Integer timeLeftSeconds) {}

  // ─── Session lifecycle ─────────────────────────────────────────────────────────

  /** Pipeline-initialises all keys for a newly created session. */
  public void initSessionKeys(Long sessionId, String joinCode, String snapshotJson) {
    String sid = sessionId.toString();
    Expiration ttl = Expiration.from(SessionRedisKeys.SESSION_TTL);
    redis.executePipelined(
        (RedisConnection conn) -> {
          conn.stringCommands()
              .set(
                  SessionRedisKeys.statusKey(sid).getBytes(),
                  SessionStatus.LOBBY.name().getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.snapshotKey(sid).getBytes(),
                  snapshotJson.getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.currentQuestionKey(sid).getBytes(),
                  "".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.participantCountKey(sid).getBytes(),
                  "0".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.questionSequenceKey(sid).getBytes(),
                  "0".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.joinCodeKey(joinCode).getBytes(),
                  sid.getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          return null;
        });
  }

  /** Transitions the session status to ACTIVE and sets the first current question. */
  public void activateSession(Long sessionId, Long firstQuestionId) {
    String sid = sessionId.toString();
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.statusKey(sid),
            SessionStatus.ACTIVE.name(),
            SessionRedisKeys.SESSION_TTL);
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.currentQuestionKey(sid),
            firstQuestionId.toString(),
            SessionRedisKeys.SESSION_TTL);
  }

  public String getStatus(Long sessionId) {
    return redis.opsForValue().get(SessionRedisKeys.statusKey(sessionId.toString()));
  }

  public void setQuestionState(Long sessionId, String state) {
    String sid = sessionId.toString();
    redis
        .opsForValue()
        .set(SessionRedisKeys.questionStateKey(sid), state, SessionRedisKeys.SESSION_TTL);
  }

  public String getQuestionState(Long sessionId) {
    return redis.opsForValue().get(SessionRedisKeys.questionStateKey(sessionId.toString()));
  }

  public String getCurrentQuestionId(Long sessionId) {
    return redis.opsForValue().get(SessionRedisKeys.currentQuestionKey(sessionId.toString()));
  }

  public void setCurrentQuestion(Long sessionId, Long questionId) {
    redis
        .opsForValue()
        .set(SessionRedisKeys.currentQuestionKey(sessionId.toString()), questionId.toString());
  }

  /** Resets current_question to empty so the next advance finds the first question. */
  public void clearCurrentQuestion(Long sessionId) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.currentQuestionKey(sessionId.toString()),
            "",
            SessionRedisKeys.SESSION_TTL);
  }

  public void setCurrentPassage(Long sessionId, Long passageId) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.currentPassageKey(sessionId.toString()),
            passageId.toString(),
            SessionRedisKeys.SESSION_TTL);
  }

  public String getCurrentPassageId(Long sessionId) {
    return redis.opsForValue().get(SessionRedisKeys.currentPassageKey(sessionId.toString()));
  }

  public void clearCurrentPassage(Long sessionId) {
    redis.delete(SessionRedisKeys.currentPassageKey(sessionId.toString()));
  }

  // ─── Join codes ────────────────────────────────────────────────────────────────

  /**
   * Reserves {@code candidate} as a join code if not already taken (SET NX). Value is a placeholder
   * until the session is created and {@link #initSessionKeys} overwrites it with the session id.
   */
  public boolean tryReserveJoinCode(String candidate) {
    Boolean reserved =
        redis
            .opsForValue()
            .setIfAbsent(
                SessionRedisKeys.joinCodeKey(candidate), "reserving", SessionRedisKeys.SESSION_TTL);
    return Boolean.TRUE.equals(reserved);
  }

  public String getSessionIdForJoinCode(String joinCode) {
    return redis.opsForValue().get(SessionRedisKeys.joinCodeKey(joinCode));
  }

  // ─── Participants ──────────────────────────────────────────────────────────────

  public long incrementParticipantCount(Long sessionId) {
    Long count =
        redis.opsForValue().increment(SessionRedisKeys.participantCountKey(sessionId.toString()));
    return count != null ? count : 0L;
  }

  public long getParticipantCount(Long sessionId) {
    String val =
        redis.opsForValue().get(SessionRedisKeys.participantCountKey(sessionId.toString()));
    return val != null ? Long.parseLong(val) : 0L;
  }

  public void cacheParticipantName(Long sessionId, Long participantId, String displayName) {
    String sid = sessionId.toString();
    redis
        .opsForHash()
        .put(SessionRedisKeys.participantNamesKey(sid), participantId.toString(), displayName);
    redis.expire(SessionRedisKeys.participantNamesKey(sid), SessionRedisKeys.SESSION_TTL);
  }

  // ─── Snapshot JSON ─────────────────────────────────────────────────────────────

  public String getSnapshotJson(String sid) {
    return redis.opsForValue().get(SessionRedisKeys.snapshotKey(sid));
  }

  public void setSnapshotJson(String sid, String json) {
    redis.opsForValue().set(SessionRedisKeys.snapshotKey(sid), json, SessionRedisKeys.SESSION_TTL);
  }

  // ─── Timer & question sequence ─────────────────────────────────────────────────

  /**
   * Records the timer as a volatile key with its own TTL matching {@code timeLimitSeconds}. The key
   * expiring naturally signals timer end; explicit deletion via {@link #clearTimer} cancels it
   * early. The remaining TTL is used by {@link #readRejoinContext} to compute time-left for
   * reconnecting participants.
   */
  public void setTimer(Long sessionId, int timeLimitSeconds) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.timerKey(sessionId.toString()),
            "1",
            Duration.ofSeconds(timeLimitSeconds));
  }

  public void clearTimer(Long sessionId) {
    redis.delete(SessionRedisKeys.timerKey(sessionId.toString()));
  }

  public Long getTimerTtlSeconds(Long sessionId) {
    return redis.getExpire(SessionRedisKeys.timerKey(sessionId.toString()));
  }

  public void recordTimerStartedAt(Long sessionId, long epochMillis) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.timerStartedAtKey(sessionId.toString()),
            String.valueOf(epochMillis),
            SessionRedisKeys.SESSION_TTL);
  }

  public Long getTimerStartedAt(Long sessionId) {
    String val = redis.opsForValue().get(SessionRedisKeys.timerStartedAtKey(sessionId.toString()));
    return val != null ? Long.parseLong(val) : null;
  }

  public long incrementQuestionSequence(Long sessionId) {
    Long next =
        redis.opsForValue().increment(SessionRedisKeys.questionSequenceKey(sessionId.toString()));
    return next != null ? next : 0L;
  }

  public long getQuestionSequence(Long sessionId) {
    String raw =
        redis.opsForValue().get(SessionRedisKeys.questionSequenceKey(sessionId.toString()));
    return raw != null ? Long.parseLong(raw) : 0L;
  }

  // ─── Rejoin context ────────────────────────────────────────────────────────────

  /**
   * Reads all volatile session state needed to reconstruct a participant's view on rejoin in one
   * place, avoiding repeated round-trips from callers.
   */
  public RejoinContext readRejoinContext(Long sessionId) {
    String questionLifecycle = getQuestionState(sessionId);

    String currentQIdStr = getCurrentQuestionId(sessionId);
    Long currentQId =
        (currentQIdStr != null && !currentQIdStr.isEmpty()) ? Long.parseLong(currentQIdStr) : null;

    String currentPassageIdStr = getCurrentPassageId(sessionId);
    Long currentPassageId =
        (currentPassageIdStr != null && !currentPassageIdStr.isEmpty())
            ? Long.parseLong(currentPassageIdStr)
            : null;

    int participantCount = (int) getParticipantCount(sessionId);

    Long ttl = getTimerTtlSeconds(sessionId);
    Integer timeLeftSeconds = (ttl != null && ttl > 0) ? ttl.intValue() : null;

    return new RejoinContext(
        questionLifecycle, currentQId, currentPassageId, participantCount, timeLeftSeconds);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────────

  /**
   * Deletes all state keys owned by this repository. Scoring keys are cleaned separately via {@link
   * SessionScoringRedisRepository#cleanupScoringKeys}.
   */
  public void cleanupSessionKeys(Long sessionId, String joinCode) {
    String sid = sessionId.toString();
    if (joinCode != null) {
      redis.delete(SessionRedisKeys.joinCodeKey(joinCode));
    }

    redis.delete(
        List.of(
            SessionRedisKeys.statusKey(sid),
            SessionRedisKeys.snapshotKey(sid),
            SessionRedisKeys.currentQuestionKey(sid),
            SessionRedisKeys.participantCountKey(sid),
            SessionRedisKeys.questionSequenceKey(sid),
            SessionRedisKeys.timerKey(sid),
            SessionRedisKeys.participantNamesKey(sid),
            SessionRedisKeys.questionStateKey(sid),
            SessionRedisKeys.currentPassageKey(sid),
            SessionRedisKeys.timerStartedAtKey(sid)));
  }
}
