package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.QuestionType;
import dev.hishaam.hermes.service.AnswerScoringService;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.List;
import org.junit.jupiter.api.Test;

class AnswerScoringServiceTest {

  private final AnswerScoringService scoringService = new AnswerScoringService();

  @Test
  void computesPositiveScoresAndClampsNegativeTotalsToZero() {
    QuizSnapshot.QuestionSnapshot question =
        question(
            new QuizSnapshot.OptionSnapshot(10L, "Correct", 8, 0),
            new QuizSnapshot.OptionSnapshot(11L, "Penalty", -12, 1),
            new QuizSnapshot.OptionSnapshot(12L, "Neutral", 0, 2));

    assertThat(scoringService.computeScore(answer(1L, 10L), question)).isEqualTo(8);
    assertThat(scoringService.computeScore(answer(1L, 10L, 11L), question)).isZero();
    assertThat(scoringService.computeScore(answer(1L, 99L), question)).isZero();
  }

  @Test
  void correctSelectionRequiresExactNonEmptySetOfPositiveOptions() {
    QuizSnapshot.QuestionSnapshot question =
        question(
            new QuizSnapshot.OptionSnapshot(10L, "Correct A", 5, 0),
            new QuizSnapshot.OptionSnapshot(11L, "Correct B", 5, 1),
            new QuizSnapshot.OptionSnapshot(12L, "Wrong", 0, 2));

    assertThat(scoringService.isCorrectSelection(answer(1L, 10L, 11L), question)).isTrue();
    assertThat(scoringService.isCorrectSelection(answer(1L, 10L), question)).isFalse();
    assertThat(scoringService.isCorrectSelection(answer(1L, 10L, 11L, 12L), question)).isFalse();
    assertThat(scoringService.isCorrectSelection(answer(1L), question)).isFalse();
    assertThat(scoringService.isCorrectSelection(null, question)).isFalse();
  }

  @Test
  void sumsScoresByParticipantAndBoundsAnswerTiming() {
    ParticipantAnswer first = answer(1L, 10L);
    first.setScore(7);
    ParticipantAnswer second = answer(1L, 11L);
    second.setScore(null);
    ParticipantAnswer third = answer(2L, 12L);
    third.setScore(4);

    assertThat(scoringService.sumScoresByParticipant(List.of(first, second, third)))
        .containsEntry(1L, 7L)
        .containsEntry(2L, 4L);

    long startedAt = Instant.parse("2026-01-01T00:00:00Z").toEpochMilli();
    assertThat(
            scoringService.computeAnswerTimeMs(
                OffsetDateTime.ofInstant(Instant.parse("2026-01-01T00:00:03Z"), ZoneOffset.UTC),
                startedAt,
                10))
        .isEqualTo(3000L);
    assertThat(
            scoringService.computeAnswerTimeMs(
                OffsetDateTime.ofInstant(Instant.parse("2026-01-01T00:00:20Z"), ZoneOffset.UTC),
                startedAt,
                10))
        .isEqualTo(10000L);
    assertThat(
            scoringService.computeAnswerTimeMs(
                OffsetDateTime.ofInstant(Instant.parse("2025-12-31T23:59:59Z"), ZoneOffset.UTC),
                startedAt,
                10))
        .isZero();
  }

  private QuizSnapshot.QuestionSnapshot question(QuizSnapshot.OptionSnapshot... options) {
    return new QuizSnapshot.QuestionSnapshot(
        100L,
        "Question",
        QuestionType.MULTI_SELECT,
        1,
        30,
        null,
        DisplayMode.LIVE,
        List.of(options),
        null);
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
