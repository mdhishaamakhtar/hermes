package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Owns per-question answer statistics in Redis: option counts, participant selections, lock-ins.
 */
@Service
public class SessionAnswerStatsStore {

  private final StringRedisTemplate redis;
  private final SessionRedisHelper redisHelper;

  public SessionAnswerStatsStore(StringRedisTemplate redis, SessionRedisHelper redisHelper) {
    this.redis = redis;
    this.redisHelper = redisHelper;
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
    return raw.stream().map(Long::parseLong).collect(LinkedHashSet::new, Set::add, Set::addAll);
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
    Long total =
        redis.opsForSet().size(redisHelper.questionAnsweredKey(sessionId.toString(), questionId));
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
    Long total =
        redis.opsForSet().size(redisHelper.questionLockedInKey(sessionId.toString(), questionId));
    return total != null ? total : 0L;
  }
}
