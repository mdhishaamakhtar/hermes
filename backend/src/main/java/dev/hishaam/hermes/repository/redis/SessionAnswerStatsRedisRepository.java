package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.util.SessionRedisKeys;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

/** Per-question answer statistics in Redis: option counts, participant selections, lock-ins. */
@Repository
public class SessionAnswerStatsRedisRepository {

  private final StringRedisTemplate redis;

  public SessionAnswerStatsRedisRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

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
}
