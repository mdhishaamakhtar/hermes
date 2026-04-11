package dev.hishaam.hermes.dto.session;

import java.util.List;

public record MyResultsResponse(
    Long participantId,
    String displayName,
    int score,
    int correctCount,
    int totalQuestions,
    int rank,
    long totalParticipants,
    List<QuestionResult> questions) {

  public record QuestionResult(
      Long questionId,
      String questionText,
      int orderIndex,
      String questionType,
      Long passageId,
      String passageText,
      List<Long> selectedOptionIds,
      List<Long> correctOptionIds,
      List<OptionInfo> options,
      boolean isCorrect,
      int pointsEarned) {}

  public record OptionInfo(
      Long id, String text, int orderIndex, boolean isCorrect, int pointValue) {}
}
