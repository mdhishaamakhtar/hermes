package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.dto.SessionResultsResponse;
import dev.hishaam.hermes.entity.SessionStatus;
import java.time.Duration;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisStringCommands;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.stereotype.Service;

@Service
public class SessionLiveStateService {

  private final StringRedisTemplate redis;
  private final SessionRedisHelper redisHelper;

  public SessionLiveStateService(StringRedisTemplate redis, SessionRedisHelper redisHelper) {
    this.redis = redis;
    this.redisHelper = redisHelper;
  }

  public record RejoinContext(
      String questionLifecycle,
      Long currentQuestionId,
      Long currentPassageId,
      int participantCount,
      Integer timeLeftSeconds) {}

  /**
   * Reads all volatile session state needed to reconstruct a participant's view on rejoin. Avoids
   * repeated round-trips from the caller.
   */
  public RejoinContext buildRejoinContext(Long sessionId) {
    String questionLifecycle = getQuestionState(sessionId);

    String currentQIdStr = getCurrentQuestionId(sessionId);
    Long currentQId =
        (currentQIdStr != null && !currentQIdStr.isEmpty()) ? Long.parseLong(currentQIdStr) : null;

    String currentPassageIdStr = getCurrentPassageId(sessionId);
    Long currentPassageId =
        (currentPassageIdStr != null && !currentPassageIdStr.isEmpty())
            ? Long.parseLong(currentPassageIdStr)
            : null;

    int participantCount = (int) getParticipantCount(sessionId);

    Long ttl = getTimerTtlSeconds(sessionId);
    Integer timeLeftSeconds = (ttl != null && ttl > 0) ? ttl.intValue() : null;

    return new RejoinContext(questionLifecycle, currentQId, currentPassageId, participantCount, timeLeftSeconds);
  }

  public void initSessionKeys(Long sessionId, String joinCode, String snapshotJson) {
    String sid = sessionId.toString();
    Expiration ttl = Expiration.from(SessionRedisHelper.SESSION_TTL);
    redis.executePipelined(
        (RedisConnection conn) -> {
          conn.stringCommands()
              .set(
                  redisHelper.statusKey(sid).getBytes(),
                  SessionStatus.LOBBY.name().getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  redisHelper.snapshotKey(sid).getBytes(),
                  snapshotJson.getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  redisHelper.currentQuestionKey(sid).getBytes(),
                  "".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  redisHelper.participantCountKey(sid).getBytes(),
                  "0".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  redisHelper.questionSequenceKey(sid).getBytes(),
                  "0".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  redisHelper.joinCodeKey(joinCode).getBytes(),
                  sid.getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          return null;
        });
  }

  public void activateSession(Long sessionId, Long firstQuestionId) {
    String sid = sessionId.toString();
    redis
        .opsForValue()
        .set(
            redisHelper.statusKey(sid),
            SessionStatus.ACTIVE.name(),
            SessionRedisHelper.SESSION_TTL);
    redis
        .opsForValue()
        .set(
            redisHelper.currentQuestionKey(sid),
            firstQuestionId.toString(),
            SessionRedisHelper.SESSION_TTL);
  }

  public void setQuestionState(Long sessionId, String state) {
    String sid = sessionId.toString();
    redis
        .opsForValue()
        .set(redisHelper.questionStateKey(sid), state, SessionRedisHelper.SESSION_TTL);
  }

  public String getQuestionState(Long sessionId) {
    String sid = sessionId.toString();
    return redis.opsForValue().get(redisHelper.questionStateKey(sid));
  }

  public void setCurrentPassage(Long sessionId, Long passageId) {
    String sid = sessionId.toString();
    redis
        .opsForValue()
        .set(
            redisHelper.currentPassageKey(sid),
            passageId.toString(),
            SessionRedisHelper.SESSION_TTL);
  }

  public String getCurrentPassageId(Long sessionId) {
    String sid = sessionId.toString();
    return redis.opsForValue().get(redisHelper.currentPassageKey(sid));
  }

  public void clearCurrentPassage(Long sessionId) {
    String sid = sessionId.toString();
    redis.delete(redisHelper.currentPassageKey(sid));
  }

  public String getStatus(Long sessionId) {
    String sid = sessionId.toString();
    return redis.opsForValue().get(redisHelper.statusKey(sid));
  }

  public String getCurrentQuestionId(Long sessionId) {
    String sid = sessionId.toString();
    return redis.opsForValue().get(redisHelper.currentQuestionKey(sid));
  }

  public void setCurrentQuestion(Long sessionId, Long questionId) {
    String sid = sessionId.toString();
    redis.opsForValue().set(redisHelper.currentQuestionKey(sid), questionId.toString());
  }

  /** Resets current_question to empty so the next advance finds the first question. */
  public void clearCurrentQuestion(Long sessionId) {
    String sid = sessionId.toString();
    redis
        .opsForValue()
        .set(redisHelper.currentQuestionKey(sid), "", SessionRedisHelper.SESSION_TTL);
  }

  public void clearTimer(Long sessionId) {
    String sid = sessionId.toString();
    redis.delete(redisHelper.timerKey(sid));
  }

  public void setTimer(Long sessionId, int timeLimitSeconds) {
    String sid = sessionId.toString();
    redis.opsForValue().set(redisHelper.timerKey(sid), "1", Duration.ofSeconds(timeLimitSeconds));
  }

  public Long getTimerTtlSeconds(Long sessionId) {
    String sid = sessionId.toString();
    return redis.getExpire(redisHelper.timerKey(sid));
  }

  public long incrementQuestionSequence(Long sessionId) {
    String sid = sessionId.toString();
    Long next = redis.opsForValue().increment(redisHelper.questionSequenceKey(sid));
    return next != null ? next : 0L;
  }

  public long getQuestionSequence(Long sessionId) {
    String sid = sessionId.toString();
    String raw = redis.opsForValue().get(redisHelper.questionSequenceKey(sid));
    return raw != null ? Long.parseLong(raw) : 0L;
  }

  public long incrementParticipantCount(Long sessionId) {
    String sid = sessionId.toString();
    Long count = redis.opsForValue().increment(redisHelper.participantCountKey(sid));
    return count != null ? count : 0L;
  }

  public long getParticipantCount(Long sessionId) {
    String sid = sessionId.toString();
    String val = redis.opsForValue().get(redisHelper.participantCountKey(sid));
    return val != null ? Long.parseLong(val) : 0L;
  }

  public String getSessionIdForJoinCode(String joinCode) {
    return redis.opsForValue().get(redisHelper.joinCodeKey(joinCode));
  }

  public void cacheParticipantName(Long sessionId, Long participantId, String displayName) {
    String sid = sessionId.toString();
    redis
        .opsForHash()
        .put(redisHelper.participantNamesKey(sid), participantId.toString(), displayName);
    redis.expire(redisHelper.participantNamesKey(sid), SessionRedisHelper.SESSION_TTL);
  }

  public void initLeaderboardEntry(Long sessionId, Long participantId) {
    String sid = sessionId.toString();
    redis.opsForZSet().add(redisHelper.leaderboardKey(sid), participantId.toString(), 0);
    redis.expire(redisHelper.leaderboardKey(sid), SessionRedisHelper.SESSION_TTL);
  }

  public void incrementLeaderboardScore(Long sessionId, Long participantId, long deltaPoints) {
    String sid = sessionId.toString();
    redis
        .opsForZSet()
        .incrementScore(redisHelper.leaderboardKey(sid), participantId.toString(), deltaPoints);
  }

  /** Replaces a participant's leaderboard score (used during regrading). */
  public void setLeaderboardScore(Long sessionId, Long participantId, long newScore) {
    String sid = sessionId.toString();
    redis.opsForZSet().add(redisHelper.leaderboardKey(sid), participantId.toString(), newScore);
  }

  public void recordTimerStartedAt(Long sessionId, long epochMillis) {
    String sid = sessionId.toString();
    redis
        .opsForValue()
        .set(
            redisHelper.timerStartedAtKey(sid),
            String.valueOf(epochMillis),
            SessionRedisHelper.SESSION_TTL);
  }

  public Long getTimerStartedAt(Long sessionId) {
    String sid = sessionId.toString();
    String val = redis.opsForValue().get(redisHelper.timerStartedAtKey(sid));
    return val != null ? Long.parseLong(val) : null;
  }

  public void incrementCumulativeTime(Long sessionId, Long participantId, long millis) {
    String sid = sessionId.toString();
    redis
        .opsForHash()
        .increment(redisHelper.cumulativeTimeKey(sid), participantId.toString(), millis);
    redis.expire(redisHelper.cumulativeTimeKey(sid), SessionRedisHelper.SESSION_TTL);
  }

  public List<SessionResultsResponse.LeaderboardEntry> buildLeaderboard(Long sessionId) {
    String sid = sessionId.toString();
    Set<ZSetOperations.TypedTuple<String>> data =
        redis.opsForZSet().reverseRangeWithScores(redisHelper.leaderboardKey(sid), 0, -1);
    if (data == null || data.isEmpty()) {
      return List.of();
    }

    Map<Object, Object> namesMap = redis.opsForHash().entries(redisHelper.participantNamesKey(sid));
    Map<Object, Object> timesMap = redis.opsForHash().entries(redisHelper.cumulativeTimeKey(sid));

    // Sort by score desc, then cumulative time asc as tiebreaker
    List<ZSetOperations.TypedTuple<String>> sorted =
        data.stream()
            .sorted(
                Comparator.<ZSetOperations.TypedTuple<String>>comparingDouble(
                        t -> -(t.getScore() != null ? t.getScore() : 0.0))
                    .thenComparingLong(
                        t -> {
                          Object val = timesMap.get(t.getValue());
                          return val != null ? Long.parseLong(val.toString()) : 0L;
                        }))
            .toList();

    AtomicLong rank = new AtomicLong(1);
    return sorted.stream()
        .map(
            tuple -> {
              Long participantId = Long.parseLong(Objects.requireNonNull(tuple.getValue()));
              long score = tuple.getScore() != null ? tuple.getScore().longValue() : 0;
              String name =
                  namesMap.containsKey(participantId.toString())
                      ? namesMap.get(participantId.toString()).toString()
                      : "Unknown";
              return new SessionResultsResponse.LeaderboardEntry(
                  (int) rank.getAndIncrement(), participantId, name, score);
            })
        .toList();
  }

  public void initQuestionCounts(Long sessionId, QuizSnapshot.QuestionSnapshot question) {
    String sid = sessionId.toString();
    Map<String, String> initial = new LinkedHashMap<>();
    question.options().forEach(option -> initial.put(option.id().toString(), "0"));
    redis.opsForHash().putAll(redisHelper.questionCountsKey(sid, question.id()), initial);
    redis.expire(redisHelper.questionCountsKey(sid, question.id()), SessionRedisHelper.SESSION_TTL);
  }

  public Set<Long> getParticipantSelectionIds(Long sessionId, Long questionId, Long participantId) {
    String sid = sessionId.toString();
    Set<String> raw =
        redis
            .opsForSet()
            .members(redisHelper.participantSelectionKey(sid, questionId, participantId));
    if (raw == null || raw.isEmpty()) {
      return Set.of();
    }
    return raw.stream()
        .map(Long::parseLong)
        .collect(java.util.LinkedHashSet::new, Set::add, Set::addAll);
  }

  public void replaceParticipantSelections(
      Long sessionId,
      Long questionId,
      Long participantId,
      Set<Long> previousSelectionIds,
      Set<Long> nextSelectionIds) {
    String sid = sessionId.toString();
    String countsKey = redisHelper.questionCountsKey(sid, questionId);
    String selectionKey = redisHelper.participantSelectionKey(sid, questionId, participantId);
    String answeredKey = redisHelper.questionAnsweredKey(sid, questionId);

    previousSelectionIds.stream()
        .filter(optionId -> !nextSelectionIds.contains(optionId))
        .forEach(optionId -> redis.opsForHash().increment(countsKey, optionId.toString(), -1));
    nextSelectionIds.stream()
        .filter(optionId -> !previousSelectionIds.contains(optionId))
        .forEach(optionId -> redis.opsForHash().increment(countsKey, optionId.toString(), 1));

    redis.delete(selectionKey);
    if (!nextSelectionIds.isEmpty()) {
      redis
          .opsForSet()
          .add(selectionKey, nextSelectionIds.stream().map(String::valueOf).toArray(String[]::new));
      redis.expire(selectionKey, SessionRedisHelper.SESSION_TTL);
      redis.opsForSet().add(answeredKey, participantId.toString());
      redis.expire(answeredKey, SessionRedisHelper.SESSION_TTL);
    } else {
      redis.opsForSet().remove(answeredKey, participantId.toString());
    }
  }

  public Map<Long, Long> getQuestionCounts(Long sessionId, Long questionId) {
    String sid = sessionId.toString();
    Map<Object, Object> rawCounts =
        redis.opsForHash().entries(redisHelper.questionCountsKey(sid, questionId));
    Map<Long, Long> counts = new LinkedHashMap<>();
    rawCounts.forEach(
        (key, value) ->
            counts.put(Long.parseLong(key.toString()), Long.parseLong(value.toString())));
    return counts;
  }

  public long getTotalAnswered(Long sessionId, Long questionId) {
    String sid = sessionId.toString();
    Long total = redis.opsForSet().size(redisHelper.questionAnsweredKey(sid, questionId));
    return total != null ? total : 0L;
  }

  public void markLockedIn(Long sessionId, Long questionId, Long participantId) {
    String sid = sessionId.toString();
    redis
        .opsForSet()
        .add(redisHelper.questionLockedInKey(sid, questionId), participantId.toString());
    redis.expire(redisHelper.questionLockedInKey(sid, questionId), SessionRedisHelper.SESSION_TTL);
  }

  public long getTotalLockedIn(Long sessionId, Long questionId) {
    String sid = sessionId.toString();
    Long total = redis.opsForSet().size(redisHelper.questionLockedInKey(sid, questionId));
    return total != null ? total : 0L;
  }

  public void cleanupSessionKeys(Long sessionId, QuizSnapshot snapshot, String joinCode) {
    String sid = sessionId.toString();
    if (joinCode != null) {
      redis.delete(redisHelper.joinCodeKey(joinCode));
    }

    snapshot
        .questions()
        .forEach(
            q ->
                redis.delete(
                    List.of(
                        redisHelper.questionCountsKey(sid, q.id()),
                        redisHelper.questionAnsweredKey(sid, q.id()),
                        redisHelper.questionLockedInKey(sid, q.id()))));

    redis.delete(
        List.of(
            redisHelper.statusKey(sid),
            redisHelper.snapshotKey(sid),
            redisHelper.currentQuestionKey(sid),
            redisHelper.participantCountKey(sid),
            redisHelper.questionSequenceKey(sid),
            redisHelper.timerKey(sid),
            redisHelper.leaderboardKey(sid),
            redisHelper.participantNamesKey(sid),
            redisHelper.questionStateKey(sid),
            redisHelper.currentPassageKey(sid),
            redisHelper.timerStartedAtKey(sid),
            redisHelper.cumulativeTimeKey(sid)));
  }
}
