package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.util.SessionRedisKeys;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

/**
 * Rejoin-token lookups in Redis. Pure cache — the Postgres fallback for expired tokens lives in
 * ParticipantService.
 */
@Repository
public class ParticipantRejoinTokenRedisRepository {

  private final StringRedisTemplate redis;

  public ParticipantRejoinTokenRedisRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

  public record TokenEntry(long sessionId, long participantId) {}

  public void store(String rejoinToken, Long participantId, Long sessionId) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.participantTokenKey(rejoinToken),
            sessionId + ":" + participantId,
            SessionRedisKeys.REJOIN_TTL);
  }

  /** Returns the cached session/participant pair, or {@code null} if absent or malformed. */
  public TokenEntry find(String rejoinToken) {
    String raw = redis.opsForValue().get(SessionRedisKeys.participantTokenKey(rejoinToken));
    if (raw == null) {
      return null;
    }
    String[] parts = raw.split(":", 2);
    if (parts.length != 2) {
      return null;
    }
    return new TokenEntry(Long.parseLong(parts[0]), Long.parseLong(parts[1]));
  }
}
