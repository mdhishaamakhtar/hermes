package dev.hishaam.hermes.util;

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
