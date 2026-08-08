package dev.hishaam.hermes.dto.session;

import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionType;
import dev.hishaam.hermes.exception.AppException;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public record QuizSnapshot(
    Long quizId, String title, List<QuestionSnapshot> questions, List<PassageSnapshot> passages) {

  public record QuestionSnapshot(
      Long id,
      String text,
      QuestionType questionType,
      int orderIndex,
      int timeLimitSeconds,
      Long passageId,
      DisplayMode effectiveDisplayMode,
      List<OptionSnapshot> options,
      OffsetDateTime correctedAt) {}

  public record OptionSnapshot(Long id, String text, int pointValue, int orderIndex) {}

  public record PassageSnapshot(
      Long id,
      String text,
      int orderIndex,
      PassageTimerMode timerMode,
      Integer timeLimitSeconds,
      List<Long> subQuestionIds) {}

  public QuestionSnapshot findQuestion(Long questionId) {
    return questions.stream().filter(q -> q.id().equals(questionId)).findFirst().orElse(null);
  }

  public PassageSnapshot findPassage(Long passageId) {
    return passages.stream().filter(p -> p.id().equals(passageId)).findFirst().orElse(null);
  }

  /**
   * Looks up a question that the caller already knows belongs to this snapshot — because the id
   * came out of the snapshot, or out of live session state derived from it. Absence means the
   * snapshot and the session state have diverged, which is corruption rather than a routine miss,
   * so it fails loudly here instead of being null-checked into a silent skip at every call site.
   */
  public QuestionSnapshot requireQuestion(Long questionId) {
    QuestionSnapshot question = findQuestion(questionId);
    if (question == null) {
      throw AppException.notFound("Question not found in session snapshot");
    }
    return question;
  }

  /** Passage equivalent of {@link #requireQuestion}, with the same contract. */
  public PassageSnapshot requirePassage(Long passageId) {
    PassageSnapshot passage = findPassage(passageId);
    if (passage == null) {
      throw AppException.notFound("Passage not found in session snapshot");
    }
    return passage;
  }

  /** Resolves every sub-question of a passage, in presentation order. */
  public List<QuestionSnapshot> subQuestionsOf(PassageSnapshot passage) {
    return passage.subQuestionIds().stream()
        .map(this::requireQuestion)
        .sorted(Comparator.comparingInt(QuestionSnapshot::orderIndex))
        .toList();
  }

  /**
   * Position of a question in the global presentation order. Standalone questions and passages
   * share a single quiz-level orderIndex space (uniqueness across both is enforced at edit time);
   * passage sub-questions slot in as fractional offsets after their passage's index, which assumes
   * a passage never has 1000+ sub-questions.
   */
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
