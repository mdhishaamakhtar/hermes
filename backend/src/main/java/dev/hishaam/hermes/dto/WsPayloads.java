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
    SESSION_END,
    PARTICIPANT_JOINED,
    ANSWER_UPDATE,
    LEADERBOARD_UPDATE
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
      PassageContext passage) {
    public QuestionDisplayed(
        Long questionId,
        String text,
        String questionType,
        List<Option> options,
        int questionIndex,
        int totalQuestions,
        PassageContext passage) {
      this(
          EventType.QUESTION_DISPLAYED,
          questionId,
          text,
          questionType,
          options,
          questionIndex,
          totalQuestions,
          passage);
    }
  }

  /** Minimal passage context included in QUESTION_DISPLAYED for PER_SUB_QUESTION passages. */
  public record PassageContext(Long id, String text) {}

  /** Sent for ENTIRE_PASSAGE mode — all sub-questions displayed simultaneously. */
  public record PassageDisplayed(
      EventType event,
      Long passageId,
      String passageText,
      List<SubQuestion> subQuestions,
      int questionIndex,
      int totalQuestions) {
    public PassageDisplayed(
        Long passageId,
        String passageText,
        List<SubQuestion> subQuestions,
        int questionIndex,
        int totalQuestions) {
      this(
          EventType.PASSAGE_DISPLAYED,
          passageId,
          passageText,
          subQuestions,
          questionIndex,
          totalQuestions);
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

  // ─── Shared ───────────────────────────────────────────────────────────────────

  public record Option(Long id, String text, int orderIndex) {}
}
