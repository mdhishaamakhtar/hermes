package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.dto.session.SessionResultsResponse;
import dev.hishaam.hermes.util.SessionRedisKeys;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Repository;

@Repository
public class SessionLeaderboardRedisRepository {

  private final StringRedisTemplate redis;

  public SessionLeaderboardRedisRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

  public void initEntry(Long sessionId, Long participantId) {
    String sid = sessionId.toString();
    redis.opsForZSet().add(SessionRedisKeys.leaderboardKey(sid), participantId.toString(), 0);
    redis.expire(SessionRedisKeys.leaderboardKey(sid), SessionRedisKeys.SESSION_TTL);
  }

  public void incrementScore(Long sessionId, Long participantId, long deltaPoints) {
    String sid = sessionId.toString();
    redis
        .opsForZSet()
        .incrementScore(
            SessionRedisKeys.leaderboardKey(sid), participantId.toString(), deltaPoints);
  }

  public void setScore(Long sessionId, Long participantId, long newScore) {
    String sid = sessionId.toString();
    redis
        .opsForZSet()
        .add(SessionRedisKeys.leaderboardKey(sid), participantId.toString(), newScore);
    redis.expire(SessionRedisKeys.leaderboardKey(sid), SessionRedisKeys.SESSION_TTL);
  }

  public void incrementCumulativeTime(Long sessionId, Long participantId, long millis) {
    String sid = sessionId.toString();
    redis
        .opsForHash()
        .increment(SessionRedisKeys.cumulativeTimeKey(sid), participantId.toString(), millis);
    redis.expire(SessionRedisKeys.cumulativeTimeKey(sid), SessionRedisKeys.SESSION_TTL);
  }

  public List<SessionResultsResponse.LeaderboardEntry> buildLeaderboard(Long sessionId) {
    String sid = sessionId.toString();
    Set<ZSetOperations.TypedTuple<String>> data =
        redis.opsForZSet().reverseRangeWithScores(SessionRedisKeys.leaderboardKey(sid), 0, -1);
    if (data == null || data.isEmpty()) {
      return List.of();
    }

    Map<Object, Object> namesMap =
        redis.opsForHash().entries(SessionRedisKeys.participantNamesKey(sid));
    Map<Object, Object> timesMap =
        redis.opsForHash().entries(SessionRedisKeys.cumulativeTimeKey(sid));

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
}
