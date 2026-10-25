package dev.hishaam.hermes.dto.session;

import java.time.OffsetDateTime;
import java.util.List;

public record SessionResultsResponse(
    Long sessionId,
    Long quizId,
    Long eventId,
    String quizTitle,
    OffsetDateTime startedAt,
    OffsetDateTime endedAt,
    long participantCount,
    int questionsAsked,
    List<QuestionResult> questions,
    List<LeaderboardEntry> leaderboard,
    List<PlayerResult> players) {

  public record QuestionResult(
      Long id,
      String text,
      int orderIndex,
      int timeLimitSeconds,
      Long passageId,
      String passageText,
      boolean asked,
      long totalAnswers,
      List<OptionInfo> options,
      boolean poll) {}

  public record OptionInfo(
      Long id, String text, boolean isCorrect, int orderIndex, long count, int pointValue) {}

  public record LeaderboardEntry(int rank, Long participantId, String displayName, long score) {}

  /**
   * One player's session: their standing, how many they got right of the questions asked, and every
   * answer they gave, for the organiser's per-player view and its export.
   */
  public record PlayerResult(
      Long participantId,
      String displayName,
      int rank,
      long score,
      int correctCount,
      int answeredCount,
      List<PlayerAnswer> answers) {}

  public record PlayerAnswer(
      Long questionId,
      List<Long> selectedOptionIds,
      int score,
      boolean correct,
      Long answerTimeMs) {}
}
