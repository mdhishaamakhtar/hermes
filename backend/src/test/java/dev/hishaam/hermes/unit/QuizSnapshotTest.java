package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionType;
import dev.hishaam.hermes.exception.AppException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for quiz snapshot ordering and correction helpers.
 *
 * <p>This class covers the record-level behavior in {@link QuizSnapshot}: ordering, lookups,
 * computed positions, and scoring corrections. It does not test any service-layer logic or any
 * external persistence.
 */
class QuizSnapshotTest {

  /**
   * Verifies that passage sub-questions and standalone questions are merged into one global
   * presentation order and that next-question lookup follows that order correctly.
   */
  @Test
  void ordersStandaloneAndPassageQuestionsByGlobalQuizPosition() {
    QuizSnapshot snapshot =
        new QuizSnapshot(
            1L,
            "Ordering",
            List.of(
                question(1L, 10, null),
                question(2L, 1, 50L),
                question(3L, 2, 50L),
                question(4L, 20, null)),
            List.of(
                new QuizSnapshot.PassageSnapshot(
                    50L, "Passage", 5, PassageTimerMode.PER_SUB_QUESTION, null, List.of(2L, 3L))));

    assertThat(Objects.requireNonNull(snapshot.findNextQuestion(null)).id()).isEqualTo(2L);
    assertThat(Objects.requireNonNull(snapshot.findNextQuestion(2L)).id()).isEqualTo(3L);
    assertThat(Objects.requireNonNull(snapshot.findNextQuestion(3L)).id()).isEqualTo(1L);
    assertThat(Objects.requireNonNull(snapshot.findNextQuestion(1L)).id()).isEqualTo(4L);
    assertThat(snapshot.findNextQuestion(4L)).isNull();
    assertThat(snapshot.questionPosition(2L)).isEqualTo(1);
    assertThat(snapshot.questionPosition(4L)).isEqualTo(4);
  }

  /**
   * Verifies that correcting one question replaces only that question's option values and stamps
   * the correction timestamp without mutating the rest of the snapshot.
   */
  @Test
  void correctedScoringReplacesOnlyTargetQuestionOptionsAndStampsCorrectionTime() {
    OffsetDateTime correctedAt = OffsetDateTime.parse("2026-01-01T00:00:00Z");
    QuizSnapshot snapshot =
        new QuizSnapshot(
            1L, "Correction", List.of(question(1L, 1, null), question(2L, 2, null)), List.of());
    long targetOption = snapshot.findQuestion(1L).options().getFirst().id();
    long untouchedOption = snapshot.findQuestion(2L).options().getFirst().id();

    QuizSnapshot corrected =
        snapshot.withCorrectedScoring(1L, Map.of(targetOption, 0), correctedAt);

    assertThat(corrected.findQuestion(1L).options().getFirst().pointValue()).isZero();
    assertThat(corrected.findQuestion(1L).correctedAt()).isEqualTo(correctedAt);
    assertThat(corrected.findQuestion(2L).options().getFirst().id()).isEqualTo(untouchedOption);
    assertThat(corrected.findQuestion(2L).options().getFirst().pointValue()).isEqualTo(10);
    assertThat(corrected.findQuestion(2L).correctedAt()).isNull();
  }

  private QuizSnapshot.QuestionSnapshot question(Long id, int orderIndex, Long passageId) {
    return new QuizSnapshot.QuestionSnapshot(
        id,
        "Q" + id,
        QuestionType.SINGLE_SELECT,
        orderIndex,
        30,
        passageId,
        DisplayMode.BLIND,
        List.of(
            new QuizSnapshot.OptionSnapshot(id * 10, "Correct", 10, 0),
            new QuizSnapshot.OptionSnapshot(id * 10 + 1, "Wrong", 0, 1)),
        null);
  }

  /**
   * Verifies the {@code require*} lookups used everywhere an id is already known to belong to the
   * snapshot. They must return the entry when present and fail loudly when it is not — the services
   * rely on that so a snapshot that has drifted from live session state cannot be silently skipped
   * into a wrong score or a blank screen.
   */
  @Test
  void requireLookupsReturnTheEntryOrFailLoudly() {
    QuizSnapshot snapshot =
        new QuizSnapshot(
            1L,
            "Lookups",
            List.of(question(1L, 1, 50L)),
            List.of(
                new QuizSnapshot.PassageSnapshot(
                    50L, "Passage", 1, PassageTimerMode.ENTIRE_PASSAGE, 60, List.of(1L))));

    assertThat(snapshot.requireQuestion(1L).id()).isEqualTo(1L);
    assertThat(snapshot.requirePassage(50L).id()).isEqualTo(50L);

    assertThatThrownBy(() -> snapshot.requireQuestion(999L))
        .isInstanceOf(AppException.class)
        .hasMessage("Question not found in session snapshot");
    assertThatThrownBy(() -> snapshot.requirePassage(999L))
        .isInstanceOf(AppException.class)
        .hasMessage("Passage not found in session snapshot");
  }

  /** Verifies sub-questions are resolved in presentation order regardless of id order. */
  @Test
  void subQuestionsOfResolvesInPresentationOrder() {
    QuizSnapshot.PassageSnapshot passage =
        new QuizSnapshot.PassageSnapshot(
            50L, "Passage", 1, PassageTimerMode.ENTIRE_PASSAGE, 60, List.of(3L, 1L, 2L));
    QuizSnapshot snapshot =
        new QuizSnapshot(
            1L,
            "Sub-questions",
            List.of(question(1L, 0, 50L), question(2L, 1, 50L), question(3L, 2, 50L)),
            List.of(passage));

    assertThat(snapshot.subQuestionsOf(passage))
        .extracting(QuizSnapshot.QuestionSnapshot::id)
        .containsExactly(1L, 2L, 3L);
  }

  /**
   * Verifies the lookups that legitimately tolerate an unknown id: advancing from a question that
   * is not in this snapshot, and asking for the position of one.
   */
  @Test
  void orderingHelpersTolerateIdsThatAreNotInTheSnapshot() {
    QuizSnapshot snapshot =
        new QuizSnapshot(1L, "Tolerant", List.of(question(1L, 1, null)), List.of());

    assertThat(snapshot.findNextQuestion(999L))
        .as("advancing from an unknown question has no successor")
        .isNull();
    assertThat(snapshot.questionPosition(999L)).isEqualTo(-1);
    assertThat(snapshot.findQuestion(999L)).isNull();
    assertThat(snapshot.findPassage(999L)).isNull();
  }

  /**
   * Verifies that a sub-question whose passage is missing from the snapshot still sorts by its own
   * index rather than throwing — ordering has to stay total even on inconsistent data.
   */
  @Test
  void globalSortKeyFallsBackToTheQuestionIndexWhenThePassageIsMissing() {
    QuizSnapshot.QuestionSnapshot orphan = question(1L, 7, 999L);
    QuizSnapshot snapshot = new QuizSnapshot(1L, "Orphan", List.of(orphan), List.of());

    assertThat(snapshot.globalSortKey(orphan)).isEqualTo(7.0);
  }
}
