package dev.hishaam.hermes.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.dto.SessionResultsResponse;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisStringCommands;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.stereotype.Component;

@Component
public class SessionRedisHelper {

  public static final Duration SESSION_TTL = Duration.ofHours(48);
  public static final Duration REJOIN_TTL = Duration.ofHours(24);

  private static final SecureRandom SECURE_RANDOM = new SecureRandom();
  private static final String JOIN_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  private static final String TOKEN_CHARS =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  private final StringRedisTemplate redis;
  private final ObjectMapper objectMapper;
  private final QuizSessionRepository sessionRepository;

  public SessionRedisHelper(
      StringRedisTemplate redis,
      ObjectMapper objectMapper,
      QuizSessionRepository sessionRepository) {
    this.redis = redis;
    this.objectMapper = objectMapper;
    this.sessionRepository = sessionRepository;
  }

  // ─── Key helpers ──────────────────────────────────────────────────────────────

  public String key(String sid, String suffix) {
    return "session:" + sid + ":" + suffix;
  }

  // ─── Snapshot serialization ───────────────────────────────────────────────────

  public String serializeSnapshot(QuizSnapshot snapshot) {
    try {
      return objectMapper.writeValueAsString(snapshot);
    } catch (JsonProcessingException e) {
      throw AppException.internalError("Failed to serialize snapshot");
    }
  }

  public QuizSnapshot deserializeSnapshot(String json) {
    try {
      return objectMapper.readValue(json, QuizSnapshot.class);
    } catch (Exception e) {
      throw AppException.internalError("Failed to deserialize snapshot");
    }
  }

  public QuizSnapshot loadSnapshot(String sid) {
    String json = redis.opsForValue().get(key(sid, "snapshot"));
    if (json == null || json.isEmpty()) {
      QuizSession session =
          sessionRepository
              .findById(Long.parseLong(sid))
              .orElseThrow(() -> AppException.notFound("Session not found"));
      json = session.getSnapshot();
      redis.opsForValue().set(key(sid, "snapshot"), json, SESSION_TTL);
    }
    return deserializeSnapshot(json);
  }

  // ─── Participant count ────────────────────────────────────────────────────────

  public long getParticipantCount(String sid) {
    String val = redis.opsForValue().get(key(sid, "participant_count"));
    return val != null ? Long.parseLong(val) : 0;
  }

  // ─── Session Redis initialization ─────────────────────────────────────────────

  public void initSessionKeys(String sid, String joinCode, String snapshotJson) {
    Expiration ttl = Expiration.from(SESSION_TTL);
    redis.executePipelined(
        (RedisConnection conn) -> {
          conn.stringCommands()
              .set(
                  key(sid, "status").getBytes(),
                  SessionStatus.LOBBY.name().getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  key(sid, "snapshot").getBytes(),
                  snapshotJson.getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  key(sid, "current_question").getBytes(),
                  "".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  key(sid, "participant_count").getBytes(),
                  "0".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  key(sid, "question_seq").getBytes(),
                  "0".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  ("joincode:" + joinCode).getBytes(),
                  sid.getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          return null;
        });
  }

  // ─── Question counts ─────────────────────────────────────────────────────────

  public void initQuestionCounts(String sid, QuizSnapshot.QuestionSnapshot question) {
    String countsKey = key(sid, "question:" + question.id() + ":counts");
    Map<String, String> initial = new LinkedHashMap<>();
    question.options().forEach(o -> initial.put(o.id().toString(), "0"));
    redis.opsForHash().putAll(countsKey, initial);
    redis.expire(countsKey, SESSION_TTL);
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────────────

  public void cacheParticipantName(String sid, Long participantId, String displayName) {
    redis.opsForHash().put(key(sid, "names"), participantId.toString(), displayName);
    redis.expire(key(sid, "names"), SESSION_TTL);
  }

  public void initLeaderboardEntry(String sid, Long participantId) {
    redis.opsForZSet().add(key(sid, "leaderboard"), participantId.toString(), 0);
    redis.expire(key(sid, "leaderboard"), SESSION_TTL);
  }

  public List<SessionResultsResponse.LeaderboardEntry> buildLeaderboard(String sid) {
    Set<ZSetOperations.TypedTuple<String>> data =
        redis.opsForZSet().reverseRangeWithScores(key(sid, "leaderboard"), 0, -1);
    if (data == null || data.isEmpty()) return List.of();

    Map<Object, Object> namesMap = redis.opsForHash().entries(key(sid, "names"));

    AtomicLong rank = new AtomicLong(1);
    return data.stream()
        .map(
            t -> {
              Long pid = Long.parseLong(t.getValue());
              long score = t.getScore() != null ? t.getScore().longValue() : 0;
              String name =
                  namesMap.containsKey(pid.toString())
                      ? namesMap.get(pid.toString()).toString()
                      : "Unknown";
              return new SessionResultsResponse.LeaderboardEntry(
                  (int) rank.getAndIncrement(), pid, name, score);
            })
        .toList();
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────────

  public void cleanupSessionKeys(String sid, QuizSnapshot snapshot, String joinCode) {
    redis.delete("joincode:" + joinCode);

    snapshot.questions().forEach(q -> redis.delete(key(sid, "question:" + q.id() + ":counts")));

    redis.delete(
        List.of(
            key(sid, "status"),
            key(sid, "snapshot"),
            key(sid, "current_question"),
            key(sid, "participant_count"),
            key(sid, "question_seq"),
            key(sid, "timer"),
            key(sid, "leaderboard"),
            key(sid, "names")));
  }

  // ─── Token generation ─────────────────────────────────────────────────────────

  /**
   * Generates a 6-character join code and atomically reserves it in Redis via SETNX. Returns the
   * code, or throws if no unique code could be generated after 10 attempts.
   */
  public String generateJoinCode() {
    for (int attempt = 0; attempt < 10; attempt++) {
      StringBuilder code = new StringBuilder(6);
      for (int i = 0; i < 6; i++) {
        code.append(JOIN_CODE_CHARS.charAt(SECURE_RANDOM.nextInt(JOIN_CODE_CHARS.length())));
      }
      String candidate = code.toString();
      Boolean reserved =
          redis.opsForValue().setIfAbsent("joincode:" + candidate, "reserving", SESSION_TTL);
      if (Boolean.TRUE.equals(reserved)) {
        return candidate;
      }
    }
    throw AppException.internalError("Failed to generate unique join code");
  }

  public String generateRejoinToken() {
    StringBuilder token = new StringBuilder(32);
    for (int i = 0; i < 32; i++) {
      token.append(TOKEN_CHARS.charAt(SECURE_RANDOM.nextInt(TOKEN_CHARS.length())));
    }
    return token.toString();
  }

  // ─── Direct Redis access (for callers needing raw ops) ────────────────────────

  public StringRedisTemplate getRedis() {
    return redis;
  }
}
