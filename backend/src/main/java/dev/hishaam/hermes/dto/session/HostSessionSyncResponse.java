package dev.hishaam.hermes.dto.session;

import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import java.util.List;
import java.util.Map;

public record HostSessionSyncResponse(
    Long sessionId,
    String status,
    QuestionLifecycleState questionLifecycle,
    String joinCode,
    int participantCount,
    Question currentQuestion,
    CurrentPassage currentPassage,
    Map<Long, QuestionStats> questionStatsById,
    List<SessionResultsResponse.LeaderboardEntry> leaderboard,
    Integer timeLeftSeconds) {

  /** A question as the host sees it — standalone, or one sub-question of the current passage. */
  public record Question(
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
      List<Question> subQuestions) {}

  public record PassageInfo(Long id, String text) {}
}
