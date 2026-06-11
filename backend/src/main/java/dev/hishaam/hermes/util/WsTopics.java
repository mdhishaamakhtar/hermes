package dev.hishaam.hermes.util;

/**
 * STOMP topic path constants for session broadcasts. Pure static helpers — not a Spring bean.
 *
 * <ul>
 *   <li>{@code question} — question lifecycle events subscribed by all participants and the
 *       organizer (QUESTION_DISPLAYED, TIMER_START, QUESTION_FROZEN, etc.).
 *   <li>{@code analytics} — live answer counts and leaderboard updates, restricted to the owning
 *       organizer by {@link dev.hishaam.hermes.ws.StompChannelInterceptor}.
 *   <li>{@code control} — participant join notifications, restricted to the organizer.
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

  public static String sessionControl(Long sessionId) {
    return "/topic/session." + sessionId + ".control";
  }
}
