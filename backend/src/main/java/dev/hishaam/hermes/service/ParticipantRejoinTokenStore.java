package dev.hishaam.hermes.service;

import dev.hishaam.hermes.entity.Participant;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class ParticipantRejoinTokenStore {

  private final StringRedisTemplate redis;
  private final SessionRedisHelper redisHelper;
  private final ParticipantRepository participantRepository;

  public ParticipantRejoinTokenStore(
      StringRedisTemplate redis,
      SessionRedisHelper redisHelper,
      ParticipantRepository participantRepository) {
    this.redis = redis;
    this.redisHelper = redisHelper;
    this.participantRepository = participantRepository;
  }

  public void store(String rejoinToken, Long participantId) {
    redis
        .opsForValue()
        .set(
            redisHelper.participantTokenKey(rejoinToken),
            participantId.toString(),
            SessionRedisHelper.REJOIN_TTL);
  }

  public Long resolveParticipantId(String rejoinToken, Long sessionId) {
    String participantIdStr = redis.opsForValue().get(redisHelper.participantTokenKey(rejoinToken));
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
