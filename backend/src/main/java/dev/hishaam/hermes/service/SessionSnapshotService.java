package dev.hishaam.hermes.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class SessionSnapshotService {

  private final StringRedisTemplate redis;
  private final ObjectMapper objectMapper;
  private final QuizSessionRepository sessionRepository;
  private final SessionRedisHelper redisHelper;

  public SessionSnapshotService(
      StringRedisTemplate redis,
      ObjectMapper objectMapper,
      QuizSessionRepository sessionRepository,
      SessionRedisHelper redisHelper) {
    this.redis = redis;
    this.objectMapper = objectMapper;
    this.sessionRepository = sessionRepository;
    this.redisHelper = redisHelper;
  }

  public String serialize(QuizSnapshot snapshot) {
    try {
      return objectMapper.writeValueAsString(snapshot);
    } catch (JsonProcessingException e) {
      throw AppException.internalError("Failed to serialize snapshot");
    }
  }

  public QuizSnapshot deserialize(String json) {
    try {
      return objectMapper.readValue(json, QuizSnapshot.class);
    } catch (Exception e) {
      throw AppException.internalError("Failed to deserialize snapshot");
    }
  }

  /** Persists the updated snapshot to both Redis and PostgreSQL. */
  public void updateSnapshot(String sid, Long sessionId, QuizSnapshot updated) {
    String json = serialize(updated);
    redis.opsForValue().set(redisHelper.snapshotKey(sid), json, SessionRedisHelper.SESSION_TTL);
    sessionRepository
        .findById(sessionId)
        .ifPresent(
            session -> {
              session.setSnapshot(json);
              sessionRepository.save(session);
            });
  }

  public QuizSnapshot loadSnapshot(String sid) {
    String json = redis.opsForValue().get(redisHelper.snapshotKey(sid));
    if (json == null || json.isEmpty()) {
      QuizSession session =
          sessionRepository
              .findById(Long.parseLong(sid))
              .orElseThrow(() -> AppException.notFound("Session not found"));
      json = session.getSnapshot();
      redis.opsForValue().set(redisHelper.snapshotKey(sid), json, SessionRedisHelper.SESSION_TTL);
    }
    return deserialize(json);
  }
}
