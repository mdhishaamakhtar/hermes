package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionType;
import dev.hishaam.hermes.service.session.SessionSnapshotService;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for the stored shape of a quiz snapshot.
 *
 * <p>Every session keeps its snapshot as JSON in PostgreSQL for good, and results pages read it
 * back long after the session ended. So the format is a contract with rows already written: the
 * application's mapper must keep reading what earlier versions stored, and must not start writing
 * anything new into it by accident.
 */
class SnapshotFormatIntegrationTest extends BaseIntegrationTest {

  /** A snapshot exactly as versions before the move to Jackson 3 wrote it, correction included. */
  private static final String STORED_BEFORE =
      """
      {"quizId": 7, "title": "Stored Quiz",
       "questions": [
         {"id": 11, "text": "Standalone", "questionType": "SINGLE_SELECT", "orderIndex": 1,
          "timeLimitSeconds": 30, "passageId": null, "effectiveDisplayMode": "BLIND",
          "options": [{"id": 101, "text": "Yes", "pointValue": 10, "orderIndex": 0},
                      {"id": 102, "text": "No", "pointValue": 0, "orderIndex": 1}],
          "correctedAt": "2026-08-08T16:37:06.939123Z"},
         {"id": 12, "text": "In passage", "questionType": "MULTI_SELECT", "orderIndex": 0,
          "timeLimitSeconds": 0, "passageId": 5, "effectiveDisplayMode": "CODE_DISPLAY",
          "options": [{"id": 103, "text": "A", "pointValue": 5, "orderIndex": 0},
                      {"id": 104, "text": "B", "pointValue": -3, "orderIndex": 1}],
          "correctedAt": null}],
       "passages": [
         {"id": 5, "text": "Read this", "orderIndex": 2, "timerMode": "ENTIRE_PASSAGE",
          "timeLimitSeconds": 60, "subQuestionIds": [12]}]}
      """;

  @Autowired private SessionSnapshotService snapshotService;

  /** Verifies that a snapshot stored by an earlier version still loads, field for field. */
  @Test
  void snapshotsStoredByEarlierVersionsStillLoad() {
    QuizSnapshot snapshot = snapshotService.deserialize(STORED_BEFORE);

    assertThat(snapshot.title()).isEqualTo("Stored Quiz");
    QuizSnapshot.QuestionSnapshot standalone = snapshot.requireQuestion(11L);
    assertThat(standalone.questionType()).isEqualTo(QuestionType.SINGLE_SELECT);
    assertThat(standalone.effectiveDisplayMode()).isEqualTo(DisplayMode.BLIND);
    assertThat(standalone.correctedAt())
        .isEqualTo(OffsetDateTime.parse("2026-08-08T16:37:06.939123Z"));
    assertThat(standalone.correctOptionIds()).containsExactly(101L);

    QuizSnapshot.QuestionSnapshot inPassage = snapshot.requireQuestion(12L);
    assertThat(inPassage.correctedAt()).isNull();
    assertThat(inPassage.optionPoints()).containsEntry(103L, 5).containsEntry(104L, -3);

    QuizSnapshot.PassageSnapshot passage = snapshot.requirePassage(5L);
    assertThat(passage.timerMode()).isEqualTo(PassageTimerMode.ENTIRE_PASSAGE);
    assertThat(passage.timeLimitSeconds()).isEqualTo(60);
    assertThat(passage.subQuestionIds()).containsExactly(12L);
  }

  /**
   * Verifies that writing a snapshot produces the same fields it was read with — in particular that
   * the answer-key helpers on a question are not mistaken for data and stored alongside it.
   */
  @Test
  void writingASnapshotStoresOnlyItsRecordFields() throws Exception {
    String written = snapshotService.serialize(snapshotService.deserialize(STORED_BEFORE));

    JsonNode before = objectMapper.readTree(STORED_BEFORE);
    JsonNode after = objectMapper.readTree(written);
    assertThat(after.path("questions").get(0).propertyNames())
        .containsExactlyInAnyOrderElementsOf(before.path("questions").get(0).propertyNames());
    assertThat(after.path("questions").get(0).path("correctedAt").asText())
        .as("timestamps stay ISO-8601 text, not epoch numbers")
        .startsWith("2026-08-08T16:37:06.939123");
    assertThat(snapshotService.deserialize(written))
        .isEqualTo(snapshotService.deserialize(STORED_BEFORE));
  }
}
