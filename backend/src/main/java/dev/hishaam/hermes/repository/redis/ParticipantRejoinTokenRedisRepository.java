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

  public void store(String rejoinToken, Long participantId) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.participantTokenKey(rejoinToken),
            participantId.toString(),
            SessionRedisKeys.REJOIN_TTL);
  }

  public Long resolveParticipantId(String rejoinToken, Long sessionId) {
    String participantIdStr =
        redis.opsForValue().get(SessionRedisKeys.participantTokenKey(rejoinToken));
    Long participantId;

    if (participantIdStr != null) {
      participantId = Long.parseLong(participantIdStr);
    } else {
      Participant participant =
          participantRepository
              .findByRejoinToken(rejoinToken)
              .orElseThrow(() -> AppException.notFound("Invalid rejoin token"));
      participantId = participant.getId();
      store(rejoinToken, participantId);
    }

    Participant participant =
        participantRepository
            .findById(participantId)
            .orElseThrow(() -> AppException.notFound("Participant not found"));

    if (!participant.getSession().getId().equals(sessionId)) {
      throw AppException.notFound("Invalid rejoin token for this session");
    }

    return participantId;
  }
}
