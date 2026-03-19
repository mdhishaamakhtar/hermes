package dev.hishaam.hermes.dto;

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
      Long selectedOptionId,
      String selectedOptionText,
      Long correctOptionId,
      String correctOptionText,
      boolean isCorrect,
      int pointsEarned) {}
}
