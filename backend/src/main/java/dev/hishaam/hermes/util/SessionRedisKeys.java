package dev.hishaam.hermes.util;

import java.time.Duration;

/** Redis key layout and TTLs for session-scoped data. Pure static helpers — not a Spring bean. */
public final class SessionRedisKeys {

  public static final Duration SESSION_TTL = Duration.ofHours(48);
  public static final Duration REJOIN_TTL = Duration.ofHours(24);

  private SessionRedisKeys() {}

  public static String sessionKey(String sid, String suffix) {
    return "session:" + sid + ":" + suffix;
  }

  public static String questionCountsKey(String sid, Long questionId) {
    return sessionKey(sid, "question:" + questionId + ":counts");
  }

  public static String questionAnsweredKey(String sid, Long questionId) {
    return sessionKey(sid, "question:" + questionId + ":answered");
  }

  public static String questionLockedInKey(String sid, Long questionId) {
    return sessionKey(sid, "question:" + questionId + ":locked_in");
  }

  public static String participantSelectionKey(String sid, Long questionId, Long participantId) {
    return sessionKey(sid, "question:" + questionId + ":participant:" + participantId);
  }

  public static String statusKey(String sid) {
    return sessionKey(sid, "status");
  }

  public static String snapshotKey(String sid) {
    return sessionKey(sid, "snapshot");
  }

  public static String currentQuestionKey(String sid) {
    return sessionKey(sid, "current_question");
  }

  public static String participantCountKey(String sid) {
    return sessionKey(sid, "participant_count");
  }

  public static String questionSequenceKey(String sid) {
    return sessionKey(sid, "question_seq");
  }

  public static String timerKey(String sid) {
    return sessionKey(sid, "timer");
  }

  public static String participantNamesKey(String sid) {
    return sessionKey(sid, "names");
  }

  public static String leaderboardKey(String sid) {
    return sessionKey(sid, "leaderboard");
  }

  public static String questionStateKey(String sid) {
    return sessionKey(sid, "question_state");
  }

  public static String currentPassageKey(String sid) {
    return sessionKey(sid, "current_passage");
  }

  public static String timerStartedAtKey(String sid) {
    return sessionKey(sid, "timer_started_at");
  }

  public static String cumulativeTimeKey(String sid) {
    return sessionKey(sid, "cumulative_time");
  }

  public static String joinCodeKey(String joinCode) {
    return "joincode:" + joinCode;
  }

  public static String participantTokenKey(String rejoinToken) {
    return "participant:" + rejoinToken;
  }
}
