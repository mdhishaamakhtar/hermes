package dev.hishaam.hermes.dto;

import java.util.Comparator;
import java.util.List;

public record QuizSnapshot(
    Long quizId, String title, List<QuestionSnapshot> questions, List<PassageSnapshot> passages) {

  public record QuestionSnapshot(
      Long id,
      String text,
      String questionType,
      int orderIndex,
      int timeLimitSeconds,
      Long passageId,
      List<OptionSnapshot> options) {}

  public record OptionSnapshot(Long id, String text, int pointValue, int orderIndex) {}

  public record PassageSnapshot(
      Long id,
      String text,
      int orderIndex,
      String timerMode,
      Integer timeLimitSeconds,
      List<Long> subQuestionIds) {}

  public QuestionSnapshot findQuestion(Long questionId) {
    return questions.stream().filter(q -> q.id().equals(questionId)).findFirst().orElse(null);
  }

  public QuestionSnapshot findNextQuestion(Long currentQuestionId) {
    if (currentQuestionId == null) {
      return questions.stream()
          .min(Comparator.comparingInt(QuestionSnapshot::orderIndex))
          .orElse(null);
    }
    QuestionSnapshot current = findQuestion(currentQuestionId);
    if (current == null) return null;
    return questions.stream()
        .filter(q -> q.orderIndex() > current.orderIndex())
        .min(Comparator.comparingInt(QuestionSnapshot::orderIndex))
        .orElse(null);
  }

  /** Returns the 1-based position of the question among all questions sorted by orderIndex. */
  public int questionPosition(Long questionId) {
    QuestionSnapshot target = findQuestion(questionId);
    if (target == null) return -1;
    return (int) questions.stream().filter(q -> q.orderIndex() <= target.orderIndex()).count();
  }
}
