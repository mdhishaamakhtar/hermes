package dev.hishaam.hermes.dto;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public record QuizSnapshot(
    Long quizId, String title, List<QuestionSnapshot> questions, List<PassageSnapshot> passages) {

  public record QuestionSnapshot(
      Long id,
      String text,
      String questionType,
      int orderIndex,
      int timeLimitSeconds,
      Long passageId,
      String effectiveDisplayMode,
      List<OptionSnapshot> options,
      OffsetDateTime correctedAt) {}

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

  public PassageSnapshot findPassage(Long passageId) {
    return passages.stream().filter(p -> p.id().equals(passageId)).findFirst().orElse(null);
  }

  public double globalSortKey(QuestionSnapshot q) {
    if (q.passageId() != null) {
      PassageSnapshot p = findPassage(q.passageId());
      if (p != null) {
        return p.orderIndex() + (q.orderIndex() / 1000.0);
      }
    }
    return (double) q.orderIndex();
  }

  public QuestionSnapshot findNextQuestion(Long currentQuestionId) {
    if (currentQuestionId == null) {
      return questions.stream().min(Comparator.comparingDouble(this::globalSortKey)).orElse(null);
    }
    QuestionSnapshot current = findQuestion(currentQuestionId);
    if (current == null) return null;
    double currentKey = globalSortKey(current);
    return questions.stream()
        .filter(q -> globalSortKey(q) > currentKey)
        .min(Comparator.comparingDouble(this::globalSortKey))
        .orElse(null);
  }

  /**
   * Finds the first question whose orderIndex is greater than the highest orderIndex of any
   * sub-question in the given passage. Used to advance past an ENTIRE_PASSAGE unit.
   */
  public QuestionSnapshot findNextAfterPassage(Long passageId) {
    PassageSnapshot passage = findPassage(passageId);
    if (passage == null) return null;
    double targetKey = passage.orderIndex() + 0.999;
    return questions.stream()
        .filter(q -> globalSortKey(q) > targetKey)
        .min(Comparator.comparingDouble(this::globalSortKey))
        .orElse(null);
  }

  /** Returns the 1-based position of the question among all questions sorted by orderIndex. */
  public int questionPosition(Long questionId) {
    List<Long> sortedIds =
        questions.stream()
            .sorted(Comparator.comparingDouble(this::globalSortKey))
            .map(QuestionSnapshot::id)
            .toList();
    int idx = sortedIds.indexOf(questionId);
    return idx == -1 ? -1 : idx + 1;
  }

  /**
   * Returns a new QuizSnapshot with the point values of the specified question's options replaced
   * by the provided map. Options not present in the map keep their original point values.
   */
  public QuizSnapshot withCorrectedScoring(
      Long questionId, Map<Long, Integer> newPointValues, OffsetDateTime correctedAt) {
    List<QuestionSnapshot> updatedQuestions =
        questions.stream()
            .map(
                q -> {
                  if (!q.id().equals(questionId)) return q;
                  List<OptionSnapshot> updatedOptions =
                      q.options().stream()
                          .map(
                              o ->
                                  new OptionSnapshot(
                                      o.id(),
                                      o.text(),
                                      newPointValues.getOrDefault(o.id(), o.pointValue()),
                                      o.orderIndex()))
                          .toList();
                  return new QuestionSnapshot(
                      q.id(),
                      q.text(),
                      q.questionType(),
                      q.orderIndex(),
                      q.timeLimitSeconds(),
                      q.passageId(),
                      q.effectiveDisplayMode(),
                      updatedOptions,
                      correctedAt);
                })
            .toList();
    return new QuizSnapshot(quizId, title, updatedQuestions, passages);
  }
}
