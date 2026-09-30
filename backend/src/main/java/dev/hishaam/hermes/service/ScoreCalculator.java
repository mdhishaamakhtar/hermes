package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.entity.enums.QuestionType;
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
   * Whether an answer counts as right. On a multi-select question that means picking exactly the
   * options with a positive point value. On a single-select question it means picking one of them:
   * a scoring correction can leave more than one option worth points, and a player can only ever
   * choose one. An empty selection is never correct.
   */
  public boolean isCorrectSelection(
      ParticipantAnswer answer, QuizSnapshot.QuestionSnapshot question) {
    if (answer == null || question == null) {
      return false;
    }

    Set<Long> selectedOptionIds = answer.getSelectedOptionIds();
    if (selectedOptionIds.isEmpty()) {
      return false;
    }
    Set<Long> correctOptionIds = Set.copyOf(question.correctOptionIds());
    return question.questionType() == QuestionType.SINGLE_SELECT
        ? correctOptionIds.containsAll(selectedOptionIds)
        : selectedOptionIds.equals(correctOptionIds);
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
