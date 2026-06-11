package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.dto.session.SessionResultsResponse;
import dev.hishaam.hermes.util.SessionRedisKeys;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Repository;

/**
 * Participant performance data in Redis: per-question option counts, selections and lock-ins, plus
 * the leaderboard ZSet and cumulative answer times used for ranking. Core session state lives in
 * {@link SessionStateRedisRepository}.
 */
@Repository
public class SessionScoringRedisRepository {

  private final StringRedisTemplate redis;

  public SessionScoringRedisRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

  // ─── Answer stats ──────────────────────────────────────────────────────────────

  public void initQuestionCounts(Long sessionId, QuizSnapshot.QuestionSnapshot question) {
    String sid = sessionId.toString();
    Map<String, String> initial = new LinkedHashMap<>();
    question.options().forEach(option -> initial.put(option.id().toString(), "0"));
    redis.opsForHash().putAll(SessionRedisKeys.questionCountsKey(sid, question.id()), initial);
    redis.expire(
        SessionRedisKeys.questionCountsKey(sid, question.id()), SessionRedisKeys.SESSION_TTL);
  }

  public Set<Long> getParticipantSelectionIds(Long sessionId, Long questionId, Long participantId) {
    String sid = sessionId.toString();
    Set<String> raw =
        redis
            .opsForSet()
            .members(SessionRedisKeys.participantSelectionKey(sid, questionId, participantId));
    if (raw == null || raw.isEmpty()) {
      return Set.of();
    }
    return raw.stream().map(Long::parseLong).collect(LinkedHashSet::new, Set::add, Set::addAll);
  }

  /**
   * Atomically updates the per-option counts and the participant's selection set in Redis.
   * Decrements counts for options that were deselected, increments for newly selected ones, and
   * replaces the participant's selection set. Also updates the answered-participant set based on
   * whether the new selection is non-empty.
   */
  public void replaceParticipantSelections(
      Long sessionId,
      Long questionId,
      Long participantId,
      Set<Long> previousSelectionIds,
      Set<Long> nextSelectionIds) {
    String sid = sessionId.toString();
    String countsKey = SessionRedisKeys.questionCountsKey(sid, questionId);
    String selectionKey = SessionRedisKeys.participantSelectionKey(sid, questionId, participantId);
    String answeredKey = SessionRedisKeys.questionAnsweredKey(sid, questionId);

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
      redis.expire(selectionKey, SessionRedisKeys.SESSION_TTL);
      redis.opsForSet().add(answeredKey, participantId.toString());
      redis.expire(answeredKey, SessionRedisKeys.SESSION_TTL);
    } else {
      redis.opsForSet().remove(answeredKey, participantId.toString());
    }
  }

  public Map<Long, Long> getQuestionCounts(Long sessionId, Long questionId) {
    String sid = sessionId.toString();
    Map<Object, Object> rawCounts =
        redis.opsForHash().entries(SessionRedisKeys.questionCountsKey(sid, questionId));
    Map<Long, Long> counts = new LinkedHashMap<>();
    rawCounts.forEach(
        (key, value) ->
            counts.put(Long.parseLong(key.toString()), Long.parseLong(value.toString())));
    return counts;
  }

  public long getTotalAnswered(Long sessionId, Long questionId) {
    Long total =
        redis
            .opsForSet()
            .size(SessionRedisKeys.questionAnsweredKey(sessionId.toString(), questionId));
    return total != null ? total : 0L;
  }

  public void markLockedIn(Long sessionId, Long questionId, Long participantId) {
    String sid = sessionId.toString();
    redis
        .opsForSet()
        .add(SessionRedisKeys.questionLockedInKey(sid, questionId), participantId.toString());
    redis.expire(
        SessionRedisKeys.questionLockedInKey(sid, questionId), SessionRedisKeys.SESSION_TTL);
  }

  public long getTotalLockedIn(Long sessionId, Long questionId) {
    Long total =
        redis
            .opsForSet()
            .size(SessionRedisKeys.questionLockedInKey(sessionId.toString(), questionId));
    return total != null ? total : 0L;
  }

  // ─── Leaderboard ───────────────────────────────────────────────────────────────

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

  /**
   * Builds the full leaderboard from the Redis sorted set, sorted by score descending then by
   * cumulative answer time ascending (faster answers rank higher among equal scores). Names are
   * resolved from the participant-names hash; absent keys fall back to "Unknown".
   */
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

  // ─── Cleanup ───────────────────────────────────────────────────────────────────

  /** Deletes all per-question stats, participant selections, and leaderboard data. */
  public void cleanupScoringKeys(Long sessionId, QuizSnapshot snapshot) {
    String sid = sessionId.toString();
    snapshot
        .questions()
        .forEach(
            q -> {
              redis.delete(
                  List.of(
                      SessionRedisKeys.questionCountsKey(sid, q.id()),
                      SessionRedisKeys.questionAnsweredKey(sid, q.id()),
                      SessionRedisKeys.questionLockedInKey(sid, q.id())));

              String pattern =
                  SessionRedisKeys.participantSelectionKey(sid, q.id(), null).replace("null", "*");
              Set<String> participantKeys = redis.keys(pattern);
              if (participantKeys != null && !participantKeys.isEmpty()) {
                redis.delete(new ArrayList<>(participantKeys));
              }
            });

    redis.delete(
        List.of(SessionRedisKeys.leaderboardKey(sid), SessionRedisKeys.cumulativeTimeKey(sid)));
  }
}
