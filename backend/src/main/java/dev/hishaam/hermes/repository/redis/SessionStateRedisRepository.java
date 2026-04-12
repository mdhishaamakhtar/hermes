package dev.hishaam.hermes.repository.redis;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.util.SessionRedisKeys;
import java.util.List;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisStringCommands;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.stereotype.Repository;

/** Core session state in Redis: status, current question/passage, participant tracking. */
@Repository
public class SessionStateRedisRepository {

  private final StringRedisTemplate redis;

  public SessionStateRedisRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

  /** Pipeline-initialises all keys for a newly created session. */
  public void initSessionKeys(Long sessionId, String joinCode, String snapshotJson) {
    String sid = sessionId.toString();
    Expiration ttl = Expiration.from(SessionRedisKeys.SESSION_TTL);
    redis.executePipelined(
        (RedisConnection conn) -> {
          conn.stringCommands()
              .set(
                  SessionRedisKeys.statusKey(sid).getBytes(),
                  SessionStatus.LOBBY.name().getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.snapshotKey(sid).getBytes(),
                  snapshotJson.getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.currentQuestionKey(sid).getBytes(),
                  "".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.participantCountKey(sid).getBytes(),
                  "0".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.questionSequenceKey(sid).getBytes(),
                  "0".getBytes(),
                  ttl,
                  RedisStringCommands.SetOption.UPSERT);
          conn.stringCommands()
              .set(
                  SessionRedisKeys.joinCodeKey(joinCode).getBytes(),
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
            SessionRedisKeys.statusKey(sid),
            SessionStatus.ACTIVE.name(),
            SessionRedisKeys.SESSION_TTL);
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.currentQuestionKey(sid),
            firstQuestionId.toString(),
            SessionRedisKeys.SESSION_TTL);
  }

  public void setQuestionState(Long sessionId, String state) {
    String sid = sessionId.toString();
    redis
        .opsForValue()
        .set(SessionRedisKeys.questionStateKey(sid), state, SessionRedisKeys.SESSION_TTL);
  }

  public String getQuestionState(Long sessionId) {
    return redis.opsForValue().get(SessionRedisKeys.questionStateKey(sessionId.toString()));
  }

  public String getStatus(Long sessionId) {
    return redis.opsForValue().get(SessionRedisKeys.statusKey(sessionId.toString()));
  }

  public String getCurrentQuestionId(Long sessionId) {
    return redis.opsForValue().get(SessionRedisKeys.currentQuestionKey(sessionId.toString()));
  }

  public void setCurrentQuestion(Long sessionId, Long questionId) {
    redis
        .opsForValue()
        .set(SessionRedisKeys.currentQuestionKey(sessionId.toString()), questionId.toString());
  }

  /** Resets current_question to empty so the next advance finds the first question. */
  public void clearCurrentQuestion(Long sessionId) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.currentQuestionKey(sessionId.toString()),
            "",
            SessionRedisKeys.SESSION_TTL);
  }

  public void setCurrentPassage(Long sessionId, Long passageId) {
    redis
        .opsForValue()
        .set(
            SessionRedisKeys.currentPassageKey(sessionId.toString()),
            passageId.toString(),
            SessionRedisKeys.SESSION_TTL);
  }

  public String getCurrentPassageId(Long sessionId) {
    return redis.opsForValue().get(SessionRedisKeys.currentPassageKey(sessionId.toString()));
  }

  public void clearCurrentPassage(Long sessionId) {
    redis.delete(SessionRedisKeys.currentPassageKey(sessionId.toString()));
  }

  public String getSessionIdForJoinCode(String joinCode) {
    return redis.opsForValue().get(SessionRedisKeys.joinCodeKey(joinCode));
  }

  public long incrementParticipantCount(Long sessionId) {
    Long count =
        redis.opsForValue().increment(SessionRedisKeys.participantCountKey(sessionId.toString()));
    return count != null ? count : 0L;
  }

  public long getParticipantCount(Long sessionId) {
    String val =
        redis.opsForValue().get(SessionRedisKeys.participantCountKey(sessionId.toString()));
    return val != null ? Long.parseLong(val) : 0L;
  }

  public void cacheParticipantName(Long sessionId, Long participantId, String displayName) {
    String sid = sessionId.toString();
    redis
        .opsForHash()
        .put(SessionRedisKeys.participantNamesKey(sid), participantId.toString(), displayName);
    redis.expire(SessionRedisKeys.participantNamesKey(sid), SessionRedisKeys.SESSION_TTL);
  }

  public void cleanupSessionKeys(Long sessionId, QuizSnapshot snapshot, String joinCode) {
    String sid = sessionId.toString();
    if (joinCode != null) {
      redis.delete(SessionRedisKeys.joinCodeKey(joinCode));
    }

    snapshot
        .questions()
        .forEach(
            q ->
                redis.delete(
                    List.of(
                        SessionRedisKeys.questionCountsKey(sid, q.id()),
                        SessionRedisKeys.questionAnsweredKey(sid, q.id()),
                        SessionRedisKeys.questionLockedInKey(sid, q.id()))));

    redis.delete(
        List.of(
            SessionRedisKeys.statusKey(sid),
            SessionRedisKeys.snapshotKey(sid),
            SessionRedisKeys.currentQuestionKey(sid),
            SessionRedisKeys.participantCountKey(sid),
            SessionRedisKeys.questionSequenceKey(sid),
            SessionRedisKeys.timerKey(sid),
            SessionRedisKeys.leaderboardKey(sid),
            SessionRedisKeys.participantNamesKey(sid),
            SessionRedisKeys.questionStateKey(sid),
            SessionRedisKeys.currentPassageKey(sid),
            SessionRedisKeys.timerStartedAtKey(sid),
            SessionRedisKeys.cumulativeTimeKey(sid)));
  }
}
