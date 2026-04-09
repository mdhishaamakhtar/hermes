package dev.hishaam.hermes.dto;

import java.util.List;
import java.util.Map;

public final class WsPayloads {

  private WsPayloads() {}

  public enum EventType {
    QUESTION_DISPLAYED,
    PASSAGE_DISPLAYED,
    TIMER_START,
    QUESTION_FROZEN,
    PASSAGE_FROZEN,
    QUESTION_REVIEWED,
    PARTICIPANT_LEADERBOARD,
    SESSION_END,
    PARTICIPANT_JOINED,
    ANSWER_UPDATE,
    ANSWER_REVEAL,
    LEADERBOARD_UPDATE,
    SCORING_CORRECTED
  }

  // ─── Question lifecycle events ────────────────────────────────────────────────

  public record QuestionDisplayed(
      EventType event,
      Long questionId,
      String text,
      String questionType,
      List<Option> options,
      int questionIndex,
      int totalQuestions,
      PassageContext passage,
      String effectiveDisplayMode) {
    public QuestionDisplayed(
        Long questionId,
        String text,
        String questionType,
        List<Option> options,
        int questionIndex,
        int totalQuestions,
        PassageContext passage,
        String effectiveDisplayMode) {
      this(
          EventType.QUESTION_DISPLAYED,
          questionId,
          text,
          questionType,
          options,
          questionIndex,
          totalQuestions,
          passage,
          effectiveDisplayMode);
    }
  }

  /** Minimal passage context included in QUESTION_DISPLAYED for PER_SUB_QUESTION passages. */
  public record PassageContext(Long id, String text) {}

  /** Sent for ENTIRE_PASSAGE mode — all sub-questions displayed simultaneously. */
  public record PassageDisplayed(
      EventType event,
      Long passageId,
      String passageText,
      Integer timeLimitSeconds,
      List<SubQuestion> subQuestions,
      int questionIndex,
      int totalQuestions,
      String effectiveDisplayMode) {
    public PassageDisplayed(
        Long passageId,
        String passageText,
        Integer timeLimitSeconds,
        List<SubQuestion> subQuestions,
        int questionIndex,
        int totalQuestions,
        String effectiveDisplayMode) {
      this(
          EventType.PASSAGE_DISPLAYED,
          passageId,
          passageText,
          timeLimitSeconds,
          subQuestions,
          questionIndex,
          totalQuestions,
          effectiveDisplayMode);
    }
  }

  public record SubQuestion(
      Long questionId, String text, String questionType, List<Option> options) {}

  /**
   * Host started the timer. {@code questionId} is set for standalone / PER_SUB_QUESTION questions;
   * {@code passageId} is set for ENTIRE_PASSAGE mode.
   */
  public record TimerStart(EventType event, Long questionId, Long passageId, int timeLimitSeconds) {
    public TimerStart(Long questionId, Long passageId, int timeLimitSeconds) {
      this(EventType.TIMER_START, questionId, passageId, timeLimitSeconds);
    }
  }

  /** Timer expired (or host ended timer early). Answers are now frozen. */
  public record QuestionFrozen(EventType event, Long questionId) {
    public QuestionFrozen(Long questionId) {
      this(EventType.QUESTION_FROZEN, questionId);
    }
  }

  /** ENTIRE_PASSAGE variant of QUESTION_FROZEN — all sub-questions freeze together. */
  public record PassageFrozen(EventType event, Long passageId, List<Long> subQuestionIds) {
    public PassageFrozen(Long passageId, List<Long> subQuestionIds) {
      this(EventType.PASSAGE_FROZEN, passageId, subQuestionIds);
    }
  }

  // ─── Grading events ───────────────────────────────────────────────────────────

  /**
   * Broadcast after a question is graded. Clients compute their own score from local selections +
   * optionPoints map. correctOptionIds contains all options with pointValue > 0.
   */
  public record QuestionReviewed(
      EventType event,
      Long questionId,
      List<Long> correctOptionIds,
      Map<Long, Integer> optionPoints) {
    public QuestionReviewed(
        Long questionId, List<Long> correctOptionIds, Map<Long, Integer> optionPoints) {
      this(EventType.QUESTION_REVIEWED, questionId, correctOptionIds, optionPoints);
    }
  }

  /** Top-5 leaderboard broadcast to all participants after each question is reviewed. */
  public record ParticipantLeaderboard(
      EventType event, List<ParticipantLeaderboardEntry> leaderboard, long totalParticipants) {
    public ParticipantLeaderboard(
        List<ParticipantLeaderboardEntry> leaderboard, long totalParticipants) {
      this(EventType.PARTICIPANT_LEADERBOARD, leaderboard, totalParticipants);
    }
  }

  public record ParticipantLeaderboardEntry(int rank, String displayName, long score) {}

  // ─── Session lifecycle ────────────────────────────────────────────────────────

  public record SessionEnd(EventType event) {
    public SessionEnd() {
      this(EventType.SESSION_END);
    }
  }

  public record SessionEndAnalytics(
      EventType event,
      List<SessionResultsResponse.LeaderboardEntry> leaderboard,
      long totalParticipants) {
    public SessionEndAnalytics(
        List<SessionResultsResponse.LeaderboardEntry> leaderboard, long totalParticipants) {
      this(EventType.SESSION_END, leaderboard, totalParticipants);
    }
  }

  // ─── Analytics events ─────────────────────────────────────────────────────────

  public record ParticipantJoined(EventType event, long count) {
    public ParticipantJoined(long count) {
      this(EventType.PARTICIPANT_JOINED, count);
    }
  }

  public record AnswerUpdate(
      EventType event,
      Long questionId,
      Map<Long, Long> counts,
      long totalAnswered,
      long totalParticipants,
      long totalLockedIn) {
    public AnswerUpdate(
        Long questionId,
        Map<Long, Long> counts,
        long totalAnswered,
        long totalParticipants,
        long totalLockedIn) {
      this(
          EventType.ANSWER_UPDATE,
          questionId,
          counts,
          totalAnswered,
          totalParticipants,
          totalLockedIn);
    }
  }

  public record LeaderboardUpdate(
      EventType event, List<SessionResultsResponse.LeaderboardEntry> leaderboard) {
    public LeaderboardUpdate(List<SessionResultsResponse.LeaderboardEntry> leaderboard) {
      this(EventType.LEADERBOARD_UPDATE, leaderboard);
    }
  }

  /**
   * Sent after grading in BLIND/CODE_DISPLAY modes to reveal the full answer distribution. Clients
   * use this to display the final counts the host was not shown during the TIMED state.
   */
  public record AnswerReveal(
      EventType event,
      Long questionId,
      Map<Long, Long> counts,
      long totalAnswered,
      long totalParticipants) {
    public AnswerReveal(
        Long questionId, Map<Long, Long> counts, long totalAnswered, long totalParticipants) {
      this(EventType.ANSWER_REVEAL, questionId, counts, totalAnswered, totalParticipants);
    }
  }

  // ─── Scoring correction ───────────────────────────────────────────────────────

  /**
   * Broadcast after a host corrects option point values. Clients recalculate their score for this
   * question using local selection state + the new optionPoints map.
   */
  public record ScoringCorrected(
      EventType event,
      Long questionId,
      List<Long> correctOptionIds,
      Map<Long, Integer> optionPoints) {
    public ScoringCorrected(
        Long questionId, List<Long> correctOptionIds, Map<Long, Integer> optionPoints) {
      this(EventType.SCORING_CORRECTED, questionId, correctOptionIds, optionPoints);
    }
  }

  // ─── Shared ───────────────────────────────────────────────────────────────────

  public record Option(Long id, String text, int orderIndex) {}
}
