package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.SessionStatus;
import java.util.List;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisStringCommands;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.stereotype.Service;

/** Owns all core session state in Redis: status, current question/passage, participant tracking. */
@Service
public class SessionStateStore {

  private final StringRedisTemplate redis;
  private final SessionRedisHelper redisHelper;

  public SessionStateStore(StringRedisTemplate redis, SessionRedisHelper redisHelper) {
    this.redis = redis;
    this.redisHelper = redisHelper;
  }

  /** Pipeline-initialises all keys for a newly created session. */
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
    return redis.opsForValue().get(redisHelper.questionStateKey(sessionId.toString()));
  }

  public String getStatus(Long sessionId) {
    return redis.opsForValue().get(redisHelper.statusKey(sessionId.toString()));
  }

  public String getCurrentQuestionId(Long sessionId) {
    return redis.opsForValue().get(redisHelper.currentQuestionKey(sessionId.toString()));
  }

  public void setCurrentQuestion(Long sessionId, Long questionId) {
    redis
        .opsForValue()
        .set(redisHelper.currentQuestionKey(sessionId.toString()), questionId.toString());
  }

  /** Resets current_question to empty so the next advance finds the first question. */
  public void clearCurrentQuestion(Long sessionId) {
    redis
        .opsForValue()
        .set(
            redisHelper.currentQuestionKey(sessionId.toString()),
            "",
            SessionRedisHelper.SESSION_TTL);
  }

  public void setCurrentPassage(Long sessionId, Long passageId) {
    redis
        .opsForValue()
        .set(
            redisHelper.currentPassageKey(sessionId.toString()),
            passageId.toString(),
            SessionRedisHelper.SESSION_TTL);
  }

  public String getCurrentPassageId(Long sessionId) {
    return redis.opsForValue().get(redisHelper.currentPassageKey(sessionId.toString()));
  }

  public void clearCurrentPassage(Long sessionId) {
    redis.delete(redisHelper.currentPassageKey(sessionId.toString()));
  }

  public String getSessionIdForJoinCode(String joinCode) {
    return redis.opsForValue().get(redisHelper.joinCodeKey(joinCode));
  }

  public long incrementParticipantCount(Long sessionId) {
    Long count =
        redis.opsForValue().increment(redisHelper.participantCountKey(sessionId.toString()));
    return count != null ? count : 0L;
  }

  public long getParticipantCount(Long sessionId) {
    String val = redis.opsForValue().get(redisHelper.participantCountKey(sessionId.toString()));
    return val != null ? Long.parseLong(val) : 0L;
  }

  public void cacheParticipantName(Long sessionId, Long participantId, String displayName) {
    String sid = sessionId.toString();
    redis
        .opsForHash()
        .put(redisHelper.participantNamesKey(sid), participantId.toString(), displayName);
    redis.expire(redisHelper.participantNamesKey(sid), SessionRedisHelper.SESSION_TTL);
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
