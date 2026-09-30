package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Stateless scoring math: per-answer scores, correctness checks, and answer-time clamping.
 * Orchestration (persisting grades, leaderboard updates, broadcasts) lives in {@link
 * GradingService}.
 */
@Service
public class ScoreCalculator {

  /**
   * Computes the total score for a single answer by summing the point values of all selected
   * options. Negative raw scores (e.g., penalty options) are clamped to zero.
   */
  public int computeScore(ParticipantAnswer answer, QuizSnapshot.QuestionSnapshot question) {
    Map<Long, Integer> pointsByOptionId = question.optionPoints();

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

    Set<Long> selectedOptionIds = answer.getSelectedOptionIds();
    return !selectedOptionIds.isEmpty()
        && selectedOptionIds.equals(Set.copyOf(question.correctOptionIds()));
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
