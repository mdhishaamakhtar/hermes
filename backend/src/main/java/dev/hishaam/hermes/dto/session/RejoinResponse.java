package dev.hishaam.hermes.dto.session;

import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.entity.enums.StageScene;
import java.util.List;
import java.util.Map;

/**
 * A player's live view, rebuilt after a reconnect. {@code myScores} holds what the player earned on
 * each graded question still on screen, keyed by question id, so a reconnect during the review
 * shows the same verdict the reveal did.
 */
public record RejoinResponse(
    Long participantId,
    Long sessionId,
    String status,
    QuestionLifecycleState questionLifecycle,
    String sessionTitle,
    int participantCount,
    Long currentQuestionId,
    Long currentPassageId,
    List<Long> alreadyAnswered,
    CurrentQuestion currentQuestion,
    CurrentPassage currentPassage,
    Map<Long, QuestionStats> questionStatsById,
    List<SessionResultsResponse.LeaderboardEntry> leaderboard,
    Integer timeLeftSeconds,
    Map<Long, Integer> myScores,
    ScoringRules scoring,
    StageScene scene) {

  public record CurrentQuestion(
      Long id,
      String text,
      int orderIndex,
      int totalQuestions,
      int timeLimitSeconds,
      String questionType,
      String effectiveDisplayMode,
      PassageInfo passage,
      List<OptionInfo> options,
      List<Long> selectedOptionIds,
      boolean lockedIn) {}

  public record CurrentPassage(
      Long id,
      String text,
      String timerMode,
      int questionIndex,
      int totalQuestions,
      Integer timeLimitSeconds,
      String effectiveDisplayMode,
      List<QuestionInfo> subQuestions) {}

  public record QuestionInfo(
      Long id,
      String text,
      int orderIndex,
      int timeLimitSeconds,
      String questionType,
      String effectiveDisplayMode,
      List<OptionInfo> options,
      List<Long> selectedOptionIds,
      boolean lockedIn) {}

  public record PassageInfo(Long id, String text, String timerMode) {}
}
