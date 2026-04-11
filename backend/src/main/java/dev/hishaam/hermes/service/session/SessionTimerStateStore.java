package dev.hishaam.hermes.service.session;

import java.time.Duration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/** Owns timer TTL, timer start timestamps, and question sequence counters in Redis. */
@Service
public class SessionTimerStateStore {

  private final StringRedisTemplate redis;
  private final SessionRedisHelper redisHelper;

  public SessionTimerStateStore(StringRedisTemplate redis, SessionRedisHelper redisHelper) {
    this.redis = redis;
    this.redisHelper = redisHelper;
  }

  public void setTimer(Long sessionId, int timeLimitSeconds) {
    redis
        .opsForValue()
        .set(redisHelper.timerKey(sessionId.toString()), "1", Duration.ofSeconds(timeLimitSeconds));
  }

  public void clearTimer(Long sessionId) {
    redis.delete(redisHelper.timerKey(sessionId.toString()));
  }

  public Long getTimerTtlSeconds(Long sessionId) {
    return redis.getExpire(redisHelper.timerKey(sessionId.toString()));
  }

  public void recordTimerStartedAt(Long sessionId, long epochMillis) {
    redis
        .opsForValue()
        .set(
            redisHelper.timerStartedAtKey(sessionId.toString()),
            String.valueOf(epochMillis),
            SessionRedisHelper.SESSION_TTL);
  }

  public Long getTimerStartedAt(Long sessionId) {
    String val = redis.opsForValue().get(redisHelper.timerStartedAtKey(sessionId.toString()));
    return val != null ? Long.parseLong(val) : null;
  }

  public long incrementQuestionSequence(Long sessionId) {
    Long next =
        redis.opsForValue().increment(redisHelper.questionSequenceKey(sessionId.toString()));
    return next != null ? next : 0L;
  }

  public long getQuestionSequence(Long sessionId) {
    String raw = redis.opsForValue().get(redisHelper.questionSequenceKey(sessionId.toString()));
    return raw != null ? Long.parseLong(raw) : 0L;
  }
}
