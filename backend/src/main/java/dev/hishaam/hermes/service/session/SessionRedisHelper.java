package dev.hishaam.hermes.service.session;

import java.time.Duration;
import org.springframework.stereotype.Component;

@Component
public class SessionRedisHelper {

  public static final Duration SESSION_TTL = Duration.ofHours(48);
  public static final Duration REJOIN_TTL = Duration.ofHours(24);

  // ─── Key helpers ──────────────────────────────────────────────────────────────

  public String key(String sid, String suffix) {
    return "session:" + sid + ":" + suffix;
  }

  public String questionCountsKey(String sid, Long questionId) {
    return key(sid, "question:" + questionId + ":counts");
  }

  public String questionAnsweredKey(String sid, Long questionId) {
    return key(sid, "question:" + questionId + ":answered");
  }

  public String questionLockedInKey(String sid, Long questionId) {
    return key(sid, "question:" + questionId + ":locked_in");
  }

  public String participantSelectionKey(String sid, Long questionId, Long participantId) {
    return key(sid, "question:" + questionId + ":participant:" + participantId);
  }

  public String statusKey(String sid) {
    return key(sid, "status");
  }

  public String snapshotKey(String sid) {
    return key(sid, "snapshot");
  }

  public String currentQuestionKey(String sid) {
    return key(sid, "current_question");
  }

  public String participantCountKey(String sid) {
    return key(sid, "participant_count");
  }

  public String questionSequenceKey(String sid) {
    return key(sid, "question_seq");
  }

  public String timerKey(String sid) {
    return key(sid, "timer");
  }

  public String participantNamesKey(String sid) {
    return key(sid, "names");
  }

  public String leaderboardKey(String sid) {
    return key(sid, "leaderboard");
  }

  public String questionStateKey(String sid) {
    return key(sid, "question_state");
  }

  public String currentPassageKey(String sid) {
    return key(sid, "current_passage");
  }

  public String timerStartedAtKey(String sid) {
    return key(sid, "timer_started_at");
  }

  public String cumulativeTimeKey(String sid) {
    return key(sid, "cumulative_time");
  }

  public String joinCodeKey(String joinCode) {
    return "joincode:" + joinCode;
  }

  public String participantTokenKey(String rejoinToken) {
    return "participant:" + rejoinToken;
  }
}
