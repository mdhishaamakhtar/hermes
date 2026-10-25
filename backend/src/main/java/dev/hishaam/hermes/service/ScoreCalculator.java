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

  /** The share of a right answer's points that speed scoring can take away, over the timer. */
  static final double SPEED_SHARE = 0.5;

  /**
   * Computes the total score for a single answer by summing the point values of all selected
   * options. Negative raw scores (e.g., penalty options) are clamped to zero, and a poll scores
   * nothing. With speed scoring, a positive score keeps all its points if given at once and loses
   * up to half of them by the end of the timer: {@code raw × (1 − 0.5 × elapsed / limit)}. Needs
   * the answer's time set first.
   */
  public int computeScore(
      ParticipantAnswer answer, QuizSnapshot.QuestionSnapshot question, boolean speedScoring) {
    if (question.votesOnly()) {
      return 0;
    }
    Map<Long, Integer> pointsByOptionId = question.optionPoints();

    int rawScore =
        answer.getSelectedOptionIds().stream()
            .map(pointsByOptionId::get)
            .filter(Objects::nonNull)
            .mapToInt(Integer::intValue)
            .sum();

    if (rawScore <= 0) {
      return 0;
    }
    if (!speedScoring || answer.getAnswerTimeMs() == null || question.timeLimitSeconds() <= 0) {
      return rawScore;
    }
    double elapsed =
        Math.min(1.0, answer.getAnswerTimeMs() / (question.timeLimitSeconds() * 1000.0));
    return (int) Math.round(rawScore * (1 - SPEED_SHARE * elapsed));
  }

  /**
   * Whether an answer counts as right. On a multi-select question that means picking exactly the
   * options with a positive point value. On a single-select question it means picking one of them:
   * a scoring correction can leave more than one option worth points, and a player can only ever
   * choose one. An empty selection is never correct, and neither is a vote in a poll.
   */
  public boolean isCorrectSelection(
      ParticipantAnswer answer, QuizSnapshot.QuestionSnapshot question) {
    if (answer == null || question == null || question.votesOnly()) {
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
