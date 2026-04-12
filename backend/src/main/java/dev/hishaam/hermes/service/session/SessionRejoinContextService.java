package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionTimerRedisRepository;
import org.springframework.stereotype.Service;

/**
 * Rejoin-only: aggregates Redis reads needed to reconstruct a participant's live view after
 * reconnect. Other session state lives in {@link SessionStateRedisRepository}, {@link
 * SessionTimerRedisRepository}, and {@link SessionAnswerStatsRedisRepository}.
 */
@Service
public class SessionRejoinContextService {

  private final SessionStateRedisRepository stateStore;
  private final SessionTimerRedisRepository timerStore;

  public SessionRejoinContextService(
      SessionStateRedisRepository stateStore, SessionTimerRedisRepository timerStore) {
    this.stateStore = stateStore;
    this.timerStore = timerStore;
  }

  public record SessionRejoinContext(
      String questionLifecycle,
      Long currentQuestionId,
      Long currentPassageId,
      int participantCount,
      Integer timeLeftSeconds) {}

  /**
   * Reads all volatile session state needed to reconstruct a participant's view on rejoin. Avoids
   * repeated round-trips from the caller.
   */
  public SessionRejoinContext buildRejoinContext(Long sessionId) {
    String questionLifecycle = stateStore.getQuestionState(sessionId);

    String currentQIdStr = stateStore.getCurrentQuestionId(sessionId);
    Long currentQId =
        (currentQIdStr != null && !currentQIdStr.isEmpty()) ? Long.parseLong(currentQIdStr) : null;

    String currentPassageIdStr = stateStore.getCurrentPassageId(sessionId);
    Long currentPassageId =
        (currentPassageIdStr != null && !currentPassageIdStr.isEmpty())
            ? Long.parseLong(currentPassageIdStr)
            : null;

    int participantCount = (int) stateStore.getParticipantCount(sessionId);

    Long ttl = timerStore.getTimerTtlSeconds(sessionId);
    Integer timeLeftSeconds = (ttl != null && ttl > 0) ? ttl.intValue() : null;

    return new SessionRejoinContext(
        questionLifecycle, currentQId, currentPassageId, participantCount, timeLeftSeconds);
  }
}
