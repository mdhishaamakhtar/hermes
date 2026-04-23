package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.entity.Participant;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.util.SessionRedisKeys;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ParticipantRejoinTokenRedisRepository {

  private final StringRedisTemplate redis;
  private final ParticipantRepository participantRepository;

  public ParticipantRejoinTokenRedisRepository(
      StringRedisTemplate redis, ParticipantRepository participantRepository) {
    this.redis = redis;
    this.participantRepository = participantRepository;
  }

  public void store(String rejoinToken, Long participantId, Long sessionId) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.participantTokenKey(rejoinToken),
            sessionId + ":" + participantId,
            SessionRedisKeys.REJOIN_TTL);
  }

  public Long resolveParticipantId(String rejoinToken, Long sessionId) {
    String raw = redis.opsForValue().get(SessionRedisKeys.participantTokenKey(rejoinToken));

    if (raw != null) {
      String[] parts = raw.split(":", 2);
      if (parts.length == 2) {
        long storedSessionId = Long.parseLong(parts[0]);
        long participantId = Long.parseLong(parts[1]);
        if (storedSessionId != sessionId) {
          throw AppException.notFound("Invalid rejoin token for this session");
        }
        return participantId;
      }
    }

    // Postgres fallback: token expired from Redis
    Participant participant =
        participantRepository
            .findByRejoinToken(rejoinToken)
            .orElseThrow(() -> AppException.notFound("Invalid rejoin token"));

    if (!participant.getSession().getId().equals(sessionId)) {
      throw AppException.notFound("Invalid rejoin token for this session");
    }

    Long participantId = participant.getId();
    store(rejoinToken, participantId, sessionId);
    return participantId;
  }
}
