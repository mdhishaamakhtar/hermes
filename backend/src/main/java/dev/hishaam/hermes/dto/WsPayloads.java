package dev.hishaam.hermes.dto;

import java.util.List;
import java.util.Map;

public final class WsPayloads {

  private WsPayloads() {}

  public enum EventType {
    QUESTION_START,
    QUESTION_END,
    SESSION_END,
    PARTICIPANT_JOINED,
    ANSWER_UPDATE,
    LEADERBOARD_UPDATE
  }

  public record QuestionStart(
      EventType event,
      Long questionId,
      String text,
      List<Option> options,
      int timeLimitSeconds,
      int questionIndex,
      int totalQuestions) {
    public QuestionStart(
        Long questionId,
        String text,
        List<Option> options,
        int timeLimitSeconds,
        int questionIndex,
        int totalQuestions) {
      this(
          EventType.QUESTION_START,
          questionId,
          text,
          options,
          timeLimitSeconds,
          questionIndex,
          totalQuestions);
    }
  }

  public record QuestionEnd(EventType event, Long questionId, Long correctOptionId) {
    public QuestionEnd(Long questionId, Long correctOptionId) {
      this(EventType.QUESTION_END, questionId, correctOptionId);
    }
  }

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

  public record Option(Long id, String text, int orderIndex) {}
}
