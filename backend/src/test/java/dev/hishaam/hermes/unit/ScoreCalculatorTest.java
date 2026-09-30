package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.QuestionType;
import dev.hishaam.hermes.service.ScoreCalculator;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for scoring math.
 *
 * <p>This class stays at the function level: score math, correctness checks, participant score
 * aggregation, and answer-time clamping. It intentionally avoids persistence, Redis, and session
 * orchestration.
 */
class ScoreCalculatorTest {

  private final ScoreCalculator scoreCalculator = new ScoreCalculator();

  /**
   * Verifies that selected option points are summed correctly and that negative totals are clamped
   * to zero.
   */
  @Test
  void computesPositiveScoresAndClampsNegativeTotalsToZero() {
    QuizSnapshot.QuestionSnapshot question =
        question(
            new QuizSnapshot.OptionSnapshot(10L, "Correct", 8, 0),
            new QuizSnapshot.OptionSnapshot(11L, "Penalty", -12, 1),
            new QuizSnapshot.OptionSnapshot(12L, "Neutral", 0, 2));

    assertThat(scoreCalculator.computeScore(answer(1L, 10L), question)).isEqualTo(8);
    assertThat(scoreCalculator.computeScore(answer(1L, 10L, 11L), question)).isZero();
    assertThat(scoreCalculator.computeScore(answer(1L, 99L), question)).isZero();
  }

  /**
   * Verifies that on a multi-select question correctness requires an exact, non-empty match with
   * all positive-value options and rejects partial, extra, or null selections.
   */
  @Test
  void multiSelectCorrectnessRequiresExactNonEmptySetOfPositiveOptions() {
    QuizSnapshot.QuestionSnapshot question =
        question(
            new QuizSnapshot.OptionSnapshot(10L, "Correct A", 5, 0),
            new QuizSnapshot.OptionSnapshot(11L, "Correct B", 5, 1),
            new QuizSnapshot.OptionSnapshot(12L, "Wrong", 0, 2));

    assertThat(scoreCalculator.isCorrectSelection(answer(1L, 10L, 11L), question)).isTrue();
    assertThat(scoreCalculator.isCorrectSelection(answer(1L, 10L), question)).isFalse();
    assertThat(scoreCalculator.isCorrectSelection(answer(1L, 10L, 11L, 12L), question)).isFalse();
    assertThat(scoreCalculator.isCorrectSelection(answer(1L), question)).isFalse();
    assertThat(scoreCalculator.isCorrectSelection(null, question)).isFalse();
  }

  /**
   * Verifies that on a single-select question picking any scoring option is correct. After a
   * scoring correction two options can both be worth points; a player can only choose one of them,
   * so demanding the full set would mark everyone wrong — including the people who just scored.
   */
  @Test
  void singleSelectCorrectnessAcceptsAnyScoringOption() {
    QuizSnapshot.QuestionSnapshot question =
        question(
            QuestionType.SINGLE_SELECT,
            new QuizSnapshot.OptionSnapshot(10L, "Original answer", 10, 0),
            new QuizSnapshot.OptionSnapshot(11L, "Also accepted after correction", 25, 1),
            new QuizSnapshot.OptionSnapshot(12L, "Wrong", 0, 2));

    assertThat(scoreCalculator.isCorrectSelection(answer(1L, 10L), question)).isTrue();
    assertThat(scoreCalculator.isCorrectSelection(answer(1L, 11L), question)).isTrue();
    assertThat(scoreCalculator.isCorrectSelection(answer(1L, 12L), question)).isFalse();
    assertThat(scoreCalculator.isCorrectSelection(answer(1L), question)).isFalse();
  }

  /** Verifies answer-time clamping against the configured timer window. */
  @Test
  void boundsAnswerTimingToTheTimerWindow() {
    long startedAt = Instant.parse("2026-01-01T00:00:00Z").toEpochMilli();
    assertThat(
            scoreCalculator.computeAnswerTimeMs(
                OffsetDateTime.ofInstant(Instant.parse("2026-01-01T00:00:03Z"), ZoneOffset.UTC),
                startedAt,
                10))
        .isEqualTo(3000L);
    assertThat(
            scoreCalculator.computeAnswerTimeMs(
                OffsetDateTime.ofInstant(Instant.parse("2026-01-01T00:00:20Z"), ZoneOffset.UTC),
                startedAt,
                10))
        .isEqualTo(10000L);
    assertThat(
            scoreCalculator.computeAnswerTimeMs(
                OffsetDateTime.ofInstant(Instant.parse("2025-12-31T23:59:59Z"), ZoneOffset.UTC),
                startedAt,
                10))
        .isZero();
  }

  private QuizSnapshot.QuestionSnapshot question(QuizSnapshot.OptionSnapshot... options) {
    return question(QuestionType.MULTI_SELECT, options);
  }

  private QuizSnapshot.QuestionSnapshot question(
      QuestionType type, QuizSnapshot.OptionSnapshot... options) {
    return new QuizSnapshot.QuestionSnapshot(
        100L, "Question", type, 1, 30, null, DisplayMode.LIVE, List.of(options), null);
  }

  private ParticipantAnswer answer(Long participantId, Long... selectedOptionIds) {
    return ParticipantAnswer.builder()
        .sessionId(1L)
        .participantId(participantId)
        .questionId(100L)
        .selectedOptionIds(new LinkedHashSet<>(List.of(selectedOptionIds)))
        .build();
  }
}
