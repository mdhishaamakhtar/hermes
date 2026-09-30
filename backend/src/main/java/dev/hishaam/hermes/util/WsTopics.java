package dev.hishaam.hermes.util;

/**
 * STOMP topic path constants for session broadcasts. Pure static helpers — not a Spring bean.
 *
 * <ul>
 *   <li>{@code question} — question lifecycle events subscribed by all participants and the
 *       organizer (QUESTION_DISPLAYED, TIMER_START, QUESTION_FROZEN, etc.), plus participant join
 *       counts.
 *   <li>{@code analytics} — live answer counts and leaderboard updates, restricted to the owning
 *       organizer by {@link dev.hishaam.hermes.ws.StompChannelInterceptor}.
 * </ul>
 */
public final class WsTopics {

  private WsTopics() {}

  public static String sessionQuestion(Long sessionId) {
    return "/topic/session." + sessionId + ".question";
  }

  public static String sessionAnalytics(Long sessionId) {
    return "/topic/session." + sessionId + ".analytics";
  }
}
