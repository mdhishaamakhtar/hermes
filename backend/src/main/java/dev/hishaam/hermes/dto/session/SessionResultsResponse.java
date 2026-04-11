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
    List<QuestionResult> questions,
    List<LeaderboardEntry> leaderboard) {

  public record QuestionResult(
      Long id,
      String text,
      int orderIndex,
      int timeLimitSeconds,
      Long passageId,
      String passageText,
      long totalAnswers,
      List<OptionInfo> options) {}

  public record OptionInfo(
      Long id, String text, boolean isCorrect, int orderIndex, long count, int pointValue) {}

  public record LeaderboardEntry(int rank, Long participantId, String displayName, long score) {}
}
