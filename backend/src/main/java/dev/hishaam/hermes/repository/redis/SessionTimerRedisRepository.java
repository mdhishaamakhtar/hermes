package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.util.SessionRedisKeys;
import java.time.Duration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

/** Timer TTL, timer start timestamps, and question sequence counters in Redis. */
@Repository
public class SessionTimerRedisRepository {

  private final StringRedisTemplate redis;

  public SessionTimerRedisRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

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
}
