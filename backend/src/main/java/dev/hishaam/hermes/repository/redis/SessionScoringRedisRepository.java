package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.dto.session.AnswerStats;
import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.util.SessionRedisKeys;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

/**
 * Live answer tallies in Redis: per-question option counts, who has answered, and who has locked
 * in. These are counters for the live display only — the answers themselves, and every score and
 * ranking derived from them, live in PostgreSQL. Core session state lives in {@link
 * SessionStateRedisRepository}.
 */
@Repository
public class SessionScoringRedisRepository {

  private final StringRedisTemplate redis;

  public SessionScoringRedisRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

  public void initQuestionCounts(Long sessionId, QuizSnapshot.QuestionSnapshot question) {
    String countsKey = SessionRedisKeys.questionCountsKey(sessionId, question.id());
    Map<String, String> initial = new LinkedHashMap<>();
    question.options().forEach(option -> initial.put(option.id().toString(), "0"));
    redis.opsForHash().putAll(countsKey, initial);
    redis.expire(countsKey, SessionRedisKeys.SESSION_TTL);
  }

  /**
   * Moves one participant's tally from their previous selection to their new one: options they
   * dropped give a count back, options they added gain one, and the answered set follows whether
   * anything is still selected. The caller holds the row lock on the participant's answer, so two
   * changes from the same participant never interleave here.
   */
  public void moveSelection(
      Long sessionId,
      Long questionId,
      Long participantId,
      Set<Long> previousSelectionIds,
      Set<Long> nextSelectionIds) {
    String countsKey = SessionRedisKeys.questionCountsKey(sessionId, questionId);
    String answeredKey = SessionRedisKeys.questionAnsweredKey(sessionId, questionId);

    previousSelectionIds.stream()
        .filter(optionId -> !nextSelectionIds.contains(optionId))
        .forEach(optionId -> redis.opsForHash().increment(countsKey, optionId.toString(), -1));
    nextSelectionIds.stream()
        .filter(optionId -> !previousSelectionIds.contains(optionId))
        .forEach(optionId -> redis.opsForHash().increment(countsKey, optionId.toString(), 1));

    if (nextSelectionIds.isEmpty()) {
      redis.opsForSet().remove(answeredKey, participantId.toString());
    } else {
      redis.opsForSet().add(answeredKey, participantId.toString());
      redis.expire(answeredKey, SessionRedisKeys.SESSION_TTL);
    }
  }

  public void markLockedIn(Long sessionId, Long questionId, Long participantId) {
    String lockedInKey = SessionRedisKeys.questionLockedInKey(sessionId, questionId);
    redis.opsForSet().add(lockedInKey, participantId.toString());
    redis.expire(lockedInKey, SessionRedisKeys.SESSION_TTL);
  }

  /** The live tallies for one question, alongside the session's participant count. */
  public AnswerStats answerStats(Long sessionId, Long questionId, long totalParticipants) {
    Map<Long, Long> counts = new LinkedHashMap<>();
    redis
        .opsForHash()
        .entries(SessionRedisKeys.questionCountsKey(sessionId, questionId))
        .forEach(
            (optionId, count) ->
                counts.put(Long.parseLong(optionId.toString()), Long.parseLong(count.toString())));
    Long answered =
        redis.opsForSet().size(SessionRedisKeys.questionAnsweredKey(sessionId, questionId));
    Long lockedIn =
        redis.opsForSet().size(SessionRedisKeys.questionLockedInKey(sessionId, questionId));
    return new AnswerStats(
        counts,
        answered != null ? answered : 0L,
        totalParticipants,
        lockedIn != null ? lockedIn : 0L);
  }

  /** Deletes the tallies of every question in the session. */
  public void cleanupScoringKeys(Long sessionId, QuizSnapshot snapshot) {
    List<String> keys = new ArrayList<>();
    for (QuizSnapshot.QuestionSnapshot question : snapshot.questions()) {
      keys.add(SessionRedisKeys.questionCountsKey(sessionId, question.id()));
      keys.add(SessionRedisKeys.questionAnsweredKey(sessionId, question.id()));
      keys.add(SessionRedisKeys.questionLockedInKey(sessionId, question.id()));
    }
    redis.delete(keys);
  }
}
