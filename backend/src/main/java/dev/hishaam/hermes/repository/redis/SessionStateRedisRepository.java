package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.entity.enums.SessionStatus;
import dev.hishaam.hermes.util.SessionRedisKeys;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisStringCommands;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.stereotype.Repository;

/**
 * Live session state in Redis: status, current question/passage, question lifecycle state, the
 * participant count, the countdown timer and question sequence, the quiz snapshot JSON, and
 * join-code reservations. Everything here shares the session TTL and is cleaned up together via
 * {@link #cleanupSessionKeys}. The live answer tallies live in {@link
 * SessionScoringRedisRepository}.
 */
@Repository
public class SessionStateRedisRepository {

  /**
   * Deletes the lock only if the caller still holds it, so an expired holder can't free another.
   */
  private static final RedisScript<Long> RELEASE_LOCK =
      new DefaultRedisScript<>(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end"
              + " return 0",
          Long.class);

  private final StringRedisTemplate redis;

  public SessionStateRedisRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

  /** Volatile state needed to rebuild a client's live view after reconnect, host or player. */
  public record RejoinContext(
      QuestionLifecycleState questionLifecycle,
      Long currentQuestionId,
      Long currentPassageId,
      int participantCount,
      Integer timeLeftSeconds) {}

  // ─── Session lifecycle ─────────────────────────────────────────────────────────

  /** Pipeline-initialises all keys for a newly created session. */
  public void initSessionKeys(Long sessionId, String joinCode, String snapshotJson) {
    Expiration ttl = Expiration.from(SessionRedisKeys.SESSION_TTL);
    redis.executePipelined(
        (RedisConnection conn) -> {
          conn.stringCommands()
              .set(
                  SessionRedisKeys.statusKey(sessionId).getBytes(),
                  SessionStatus.LOBBY.name().getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.snapshotKey(sessionId).getBytes(),
                  snapshotJson.getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.currentQuestionKey(sessionId).getBytes(),
                  "".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.participantCountKey(sessionId).getBytes(),
                  "0".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.questionSequenceKey(sessionId).getBytes(),
                  "0".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.joinCodeKey(joinCode).getBytes(),
                  sessionId.toString().getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          return null;
        });
  }

  /**
   * Marks the session ACTIVE. No question is current yet — the first advance picks the opening one.
   */
  public void activateSession(Long sessionId) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.statusKey(sessionId),
            SessionStatus.ACTIVE.name(),
            SessionRedisKeys.SESSION_TTL);
  }

  public SessionStatus getStatus(Long sessionId) {
    return parse(
        redis.opsForValue().get(SessionRedisKeys.statusKey(sessionId)), SessionStatus::valueOf);
  }

  public void setQuestionState(Long sessionId, QuestionLifecycleState state) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.questionStateKey(sessionId),
            state.name(),
            SessionRedisKeys.SESSION_TTL);
  }

  public QuestionLifecycleState getQuestionState(Long sessionId) {
    return parse(
        redis.opsForValue().get(SessionRedisKeys.questionStateKey(sessionId)),
        QuestionLifecycleState::valueOf);
  }

  /**
   * Returns null when no question is current — the key is absent or holds the empty placeholder.
   */
  public Long getCurrentQuestionId(Long sessionId) {
    return parse(
        redis.opsForValue().get(SessionRedisKeys.currentQuestionKey(sessionId)), Long::valueOf);
  }

  public void setCurrentQuestion(Long sessionId, Long questionId) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.currentQuestionKey(sessionId),
            questionId.toString(),
            SessionRedisKeys.SESSION_TTL);
  }

  public void setCurrentPassage(Long sessionId, Long passageId) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.currentPassageKey(sessionId),
            passageId.toString(),
            SessionRedisKeys.SESSION_TTL);
  }

  /** Returns null when the session is not inside an ENTIRE_PASSAGE block. */
  public Long getCurrentPassageId(Long sessionId) {
    return parse(
        redis.opsForValue().get(SessionRedisKeys.currentPassageKey(sessionId)), Long::valueOf);
  }

  public void clearCurrentPassage(Long sessionId) {
    redis.delete(SessionRedisKeys.currentPassageKey(sessionId));
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
    Long count = redis.opsForValue().increment(SessionRedisKeys.participantCountKey(sessionId));
    return count != null ? count : 0L;
  }

  public long getParticipantCount(Long sessionId) {
    String val = redis.opsForValue().get(SessionRedisKeys.participantCountKey(sessionId));
    return val != null ? Long.parseLong(val) : 0L;
  }

  // ─── Snapshot JSON ─────────────────────────────────────────────────────────────

  public String getSnapshotJson(Long sessionId) {
    return redis.opsForValue().get(SessionRedisKeys.snapshotKey(sessionId));
  }

  public void setSnapshotJson(Long sessionId, String json) {
    redis
        .opsForValue()
        .set(SessionRedisKeys.snapshotKey(sessionId), json, SessionRedisKeys.SESSION_TTL);
  }

  // ─── Timer & question sequence ─────────────────────────────────────────────────

  /**
   * Records the timer as a volatile key with its own TTL matching {@code timeLimitSeconds}. The key
   * expiring naturally signals timer end; explicit deletion via {@link #clearTimer} cancels it
   * early. The remaining TTL is used by {@link #readRejoinContext} to compute time-left for
   * reconnecting clients.
   */
  public void setTimer(Long sessionId, int timeLimitSeconds) {
    redis
        .opsForValue()
        .set(SessionRedisKeys.timerKey(sessionId), "1", Duration.ofSeconds(timeLimitSeconds));
  }

  public void clearTimer(Long sessionId) {
    redis.delete(SessionRedisKeys.timerKey(sessionId));
  }

  public void recordTimerStartedAt(Long sessionId, long epochMillis) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.timerStartedAtKey(sessionId),
            String.valueOf(epochMillis),
            SessionRedisKeys.SESSION_TTL);
  }

  public Long getTimerStartedAt(Long sessionId) {
    String val = redis.opsForValue().get(SessionRedisKeys.timerStartedAtKey(sessionId));
    return val != null ? Long.parseLong(val) : null;
  }

  public long incrementQuestionSequence(Long sessionId) {
    Long next = redis.opsForValue().increment(SessionRedisKeys.questionSequenceKey(sessionId));
    return next != null ? next : 0L;
  }

  public long getQuestionSequence(Long sessionId) {
    String raw = redis.opsForValue().get(SessionRedisKeys.questionSequenceKey(sessionId));
    return raw != null ? Long.parseLong(raw) : 0L;
  }

  // ─── Transition lock ───────────────────────────────────────────────────────────

  /**
   * Takes the session's transition lock if it is free and returns the token that releases it, or
   * null if another holder has it. The lock lapses after {@code ttl}, so a holder that dies cannot
   * wedge the session.
   */
  public String tryLockTransitions(Long sessionId, Duration ttl) {
    String token = UUID.randomUUID().toString();
    Boolean taken =
        redis.opsForValue().setIfAbsent(SessionRedisKeys.transitionLockKey(sessionId), token, ttl);
    return Boolean.TRUE.equals(taken) ? token : null;
  }

  public void unlockTransitions(Long sessionId, String token) {
    redis.execute(RELEASE_LOCK, List.of(SessionRedisKeys.transitionLockKey(sessionId)), token);
  }

  // ─── Rejoin context ────────────────────────────────────────────────────────────

  /**
   * Reads everything needed to rebuild a client's live view in two round trips: one MGET for the
   * state keys, one TTL for the time left on the countdown.
   */
  public RejoinContext readRejoinContext(Long sessionId) {
    List<String> values =
        redis
            .opsForValue()
            .multiGet(
                List.of(
                    SessionRedisKeys.questionStateKey(sessionId),
                    SessionRedisKeys.currentQuestionKey(sessionId),
                    SessionRedisKeys.currentPassageKey(sessionId),
                    SessionRedisKeys.participantCountKey(sessionId)));
    Long ttl = redis.getExpire(SessionRedisKeys.timerKey(sessionId));
    Integer participantCount = parse(values.get(3), Integer::valueOf);

    return new RejoinContext(
        parse(values.get(0), QuestionLifecycleState::valueOf),
        parse(values.get(1), Long::valueOf),
        parse(values.get(2), Long::valueOf),
        participantCount != null ? participantCount : 0,
        (ttl != null && ttl > 0) ? ttl.intValue() : null);
  }

  /**
   * Converts a raw Redis string into a typed value, treating both a missing key and the
   * empty-string placeholder written by {@link #initSessionKeys} as absent.
   */
  private static <T> T parse(String raw, Function<String, T> converter) {
    return (raw == null || raw.isEmpty()) ? null : converter.apply(raw);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────────

  /**
   * Deletes all state keys owned by this repository. Scoring keys are cleaned separately via {@link
   * SessionScoringRedisRepository#cleanupScoringKeys}.
   */
  public void cleanupSessionKeys(Long sessionId, String joinCode) {
    if (joinCode != null) {
      redis.delete(SessionRedisKeys.joinCodeKey(joinCode));
    }

    redis.delete(
        List.of(
            SessionRedisKeys.statusKey(sessionId),
            SessionRedisKeys.snapshotKey(sessionId),
            SessionRedisKeys.currentQuestionKey(sessionId),
            SessionRedisKeys.participantCountKey(sessionId),
            SessionRedisKeys.questionSequenceKey(sessionId),
            SessionRedisKeys.timerKey(sessionId),
            SessionRedisKeys.questionStateKey(sessionId),
            SessionRedisKeys.currentPassageKey(sessionId),
            SessionRedisKeys.timerStartedAtKey(sessionId)));
  }
}
