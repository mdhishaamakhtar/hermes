package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.util.SessionRedisKeys;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

/** Atomic join-code reservation in Redis (SET NX with TTL). */
@Repository
public class SessionJoinCodeRedisRepository {

  private final StringRedisTemplate redis;

  public SessionJoinCodeRedisRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

  /**
   * Reserves {@code candidate} as a join code if not already taken. Value is a placeholder until
   * the session is created and the key is overwritten with the real session id.
   */
  public boolean tryReserveJoinCode(String candidate) {
    Boolean reserved =
        redis
            .opsForValue()
            .setIfAbsent(
                SessionRedisKeys.joinCodeKey(candidate), "reserving", SessionRedisKeys.SESSION_TTL);
    return Boolean.TRUE.equals(reserved);
  }
}
