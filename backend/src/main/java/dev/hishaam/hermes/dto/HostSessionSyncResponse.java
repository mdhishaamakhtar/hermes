package dev.hishaam.hermes.dto;

import java.util.List;
import java.util.Map;

public record HostSessionSyncResponse(
    Long sessionId,
    String status,
    String questionLifecycle,
    String joinCode,
    int participantCount,
    CurrentQuestion currentQuestion,
    CurrentPassage currentPassage,
    Map<Long, QuestionStats> questionStatsById,
    List<SessionResultsResponse.LeaderboardEntry> leaderboard,
    Integer timeLeftSeconds) {

  public record CurrentQuestion(
      Long id,
      String text,
      String questionType,
      int orderIndex,
      int totalQuestions,
      int timeLimitSeconds,
      String effectiveDisplayMode,
      PassageInfo passage,
      List<OptionInfo> options) {}

  public record CurrentPassage(
      Long id,
      String text,
      String timerMode,
      int questionIndex,
      int totalQuestions,
      Integer timeLimitSeconds,
      String effectiveDisplayMode,
      List<PassageQuestionInfo> subQuestions) {}

  public record PassageQuestionInfo(
      Long id,
      String text,
      String questionType,
      int orderIndex,
      int totalQuestions,
      int timeLimitSeconds,
      String effectiveDisplayMode,
      PassageInfo passage,
      List<OptionInfo> options) {}

  public record PassageInfo(Long id, String text) {}

  public record OptionInfo(Long id, String text, int orderIndex) {}

  public record QuestionStats(
      Map<Long, Long> counts,
      long totalAnswered,
      long totalLockedIn,
      long totalParticipants,
      List<Long> correctOptionIds,
      Map<Long, Integer> optionPoints,
      boolean revealed,
      boolean reviewed) {}
}
