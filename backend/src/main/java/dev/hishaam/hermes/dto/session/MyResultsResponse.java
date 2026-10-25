package dev.hishaam.hermes.dto.session;

import java.util.List;

public record MyResultsResponse(
    Long participantId,
    String displayName,
    int score,
    int correctCount,
    int totalQuestions,
    int questionsAsked,
    int rank,
    long totalParticipants,
    List<QuestionResult> questions,
    String quizTitle) {

  public record QuestionResult(
      Long questionId,
      String questionText,
      int orderIndex,
      String questionType,
      Long passageId,
      String passageText,
      boolean asked,
      List<Long> selectedOptionIds,
      List<Long> correctOptionIds,
      List<OptionInfo> options,
      boolean isCorrect,
      int pointsEarned,
      boolean poll) {}

  public record OptionInfo(
      Long id, String text, int orderIndex, boolean isCorrect, int pointValue) {}
}
