package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Stateless scoring math: per-answer scores, correctness checks, participant totals, and
 * answer-time clamping. Orchestration (persisting grades, leaderboard updates, broadcasts) lives in
 * {@link GradingService}.
 */
@Service
public class ScoreCalculator {

  /**
   * Computes the total score for a single answer by summing the point values of all selected
   * options. Negative raw scores (e.g., penalty options) are clamped to zero.
   */
  public int computeScore(ParticipantAnswer answer, QuizSnapshot.QuestionSnapshot question) {
    Map<Long, Integer> pointsByOptionId = new LinkedHashMap<>();
    question.options().forEach(o -> pointsByOptionId.put(o.id(), o.pointValue()));

    int rawScore =
        answer.getSelectedOptionIds().stream()
            .map(pointsByOptionId::get)
            .filter(Objects::nonNull)
            .mapToInt(Integer::intValue)
            .sum();

    return Math.max(rawScore, 0);
  }

  /**
   * Returns {@code true} if the answer's selected options exactly match the set of options with a
   * positive point value. An empty selection is never considered correct.
   */
  public boolean isCorrectSelection(
      ParticipantAnswer answer, QuizSnapshot.QuestionSnapshot question) {
    if (answer == null || question == null) {
      return false;
    }

    Set<Long> selectedOptionIds = new LinkedHashSet<>(answer.getSelectedOptionIds());
    Set<Long> correctOptionIds =
        question.options().stream()
            .filter(option -> option.pointValue() > 0)
            .map(QuizSnapshot.OptionSnapshot::id)
            .collect(LinkedHashSet::new, Set::add, Set::addAll);

    return !selectedOptionIds.isEmpty() && selectedOptionIds.equals(correctOptionIds);
  }

  /** Aggregates graded answers into a map of participantId → total score across all questions. */
  public Map<Long, Long> sumScoresByParticipant(List<ParticipantAnswer> answers) {
    Map<Long, Long> participantTotals = new LinkedHashMap<>();
    answers.forEach(
        answer ->
            participantTotals.merge(
                answer.getParticipantId(),
                (long) (answer.getScore() != null ? answer.getScore() : 0),
                (a, b) -> Long.sum(Objects.requireNonNull(a), Objects.requireNonNull(b))));
    return participantTotals;
  }

  /**
   * Computes how many milliseconds elapsed between {@code timerStartedAt} and {@code answeredAt},
   * clamped to {@code [0, timeLimitSeconds * 1000]}. Used to break ties in leaderboard ranking:
   * among participants with the same score, faster answers rank higher.
   */
  public long computeAnswerTimeMs(
      OffsetDateTime answeredAt, long timerStartedAtEpochMs, int timeLimitSeconds) {
    long answeredAtMs = answeredAt.toInstant().toEpochMilli();
    long elapsed = answeredAtMs - timerStartedAtEpochMs;
    long maxMs = (long) timeLimitSeconds * 1000;
    return Math.clamp(elapsed, 0L, maxMs);
  }
}
