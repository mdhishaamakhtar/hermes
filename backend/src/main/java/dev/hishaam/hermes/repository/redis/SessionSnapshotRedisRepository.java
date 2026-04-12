package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.util.SessionRedisKeys;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SessionSnapshotRedisRepository {

  private final StringRedisTemplate redis;

  public SessionSnapshotRedisRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

  public String getSnapshotJson(String sid) {
    return redis.opsForValue().get(SessionRedisKeys.snapshotKey(sid));
  }

  public void setSnapshotJson(String sid, String json) {
    redis.opsForValue().set(SessionRedisKeys.snapshotKey(sid), json, SessionRedisKeys.SESSION_TTL);
  }
}
