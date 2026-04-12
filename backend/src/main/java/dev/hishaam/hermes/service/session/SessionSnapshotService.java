package dev.hishaam.hermes.service.session;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.redis.SessionSnapshotRedisRepository;
import org.springframework.stereotype.Service;

@Service
public class SessionSnapshotService {

  private final ObjectMapper objectMapper;
  private final QuizSessionRepository sessionRepository;
  private final SessionSnapshotRedisRepository snapshotRedis;

  public SessionSnapshotService(
      ObjectMapper objectMapper,
      QuizSessionRepository sessionRepository,
      SessionSnapshotRedisRepository snapshotRedis) {
    this.objectMapper = objectMapper;
    this.sessionRepository = sessionRepository;
    this.snapshotRedis = snapshotRedis;
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
    snapshotRedis.setSnapshotJson(sid, json);
    sessionRepository
        .findById(sessionId)
        .ifPresent(
            session -> {
              session.setSnapshot(json);
              sessionRepository.save(session);
            });
  }

  public QuizSnapshot loadSnapshot(String sid) {
    String json = snapshotRedis.getSnapshotJson(sid);
    if (json == null || json.isEmpty()) {
      QuizSession session =
          sessionRepository
              .findById(Long.parseLong(sid))
              .orElseThrow(() -> AppException.notFound("Session not found"));
      json = session.getSnapshot();
      snapshotRedis.setSnapshotJson(sid, json);
    }
    return deserialize(json);
  }
}
