package dev.hishaam.hermes.service.session;

import org.springframework.stereotype.Service;

/**
 * Thin facade that aggregates cross-store reads for participant rejoin. All other session state
 * operations have been extracted to {@link SessionStateStore}, {@link SessionTimerStateStore}, and
 * {@link SessionAnswerStatsStore}.
 */
@Service
public class SessionLiveStateService {

  private final SessionStateStore stateStore;
  private final SessionTimerStateStore timerStore;

  public SessionLiveStateService(SessionStateStore stateStore, SessionTimerStateStore timerStore) {
    this.stateStore = stateStore;
    this.timerStore = timerStore;
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

    return new RejoinContext(
        questionLifecycle, currentQId, currentPassageId, participantCount, timeLeftSeconds);
  }
}
