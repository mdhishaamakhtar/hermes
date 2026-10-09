package dev.hishaam.hermes.util;

import java.time.Duration;

/** Redis key layout and TTLs for session-scoped data. Pure static helpers — not a Spring bean. */
public final class SessionRedisKeys {

  public static final Duration SESSION_TTL = Duration.ofHours(48);
  public static final Duration REJOIN_TTL = Duration.ofHours(24);

  private SessionRedisKeys() {}

  private static String sessionKey(Long sessionId, String suffix) {
    return "session:" + sessionId + ":" + suffix;
  }

  public static String questionCountsKey(Long sessionId, Long questionId) {
    return sessionKey(sessionId, "question:" + questionId + ":counts");
  }

  public static String questionAnsweredKey(Long sessionId, Long questionId) {
    return sessionKey(sessionId, "question:" + questionId + ":answered");
  }

  public static String questionLockedInKey(Long sessionId, Long questionId) {
    return sessionKey(sessionId, "question:" + questionId + ":locked_in");
  }

  public static String statusKey(Long sessionId) {
    return sessionKey(sessionId, "status");
  }

  public static String snapshotKey(Long sessionId) {
    return sessionKey(sessionId, "snapshot");
  }

  public static String currentQuestionKey(Long sessionId) {
    return sessionKey(sessionId, "current_question");
  }

  public static String participantCountKey(Long sessionId) {
    return sessionKey(sessionId, "participant_count");
  }

  public static String questionSequenceKey(Long sessionId) {
    return sessionKey(sessionId, "question_seq");
  }

  public static String timerKey(Long sessionId) {
    return sessionKey(sessionId, "timer");
  }

  public static String questionStateKey(Long sessionId) {
    return sessionKey(sessionId, "question_state");
  }

  public static String currentPassageKey(Long sessionId) {
    return sessionKey(sessionId, "current_passage");
  }

  public static String timerStartedAtKey(Long sessionId) {
    return sessionKey(sessionId, "timer_started_at");
  }

  public static String transitionLockKey(Long sessionId) {
    return sessionKey(sessionId, "transition_lock");
  }

  public static String joinCodeKey(String joinCode) {
    return "joincode:" + joinCode;
  }

  public static String participantTokenKey(String rejoinToken) {
    return "participant:" + rejoinToken;
  }
}
