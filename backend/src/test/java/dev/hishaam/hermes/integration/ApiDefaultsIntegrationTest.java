package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Integration tests for the optional half of the write API.
 *
 * <p>Most request fields are optional and are filled in server-side — order indexes, question type,
 * display mode, passage timer mode, per-option ordering. Every other suite sends fully-populated
 * payloads, so those defaults are part of the public contract that nothing exercises. These tests
 * send the minimum the validator accepts and assert what comes back.
 */
class ApiDefaultsIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that a quiz created with only a title lands on orderIndex 0 and BLIND display mode,
   * and that an update omitting the same fields resets rather than preserves them.
   */
  @Test
  void quizOmittingOrderIndexAndDisplayModeFallsBackToZeroAndBlind() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Defaults Event");

    JsonNode created =
        postJson("/api/events/" + eventId + "/quizzes", owner, Map.of("title", "Bare Quiz"), 201)
            .path("data");
    assertThat(created.path("orderIndex").asInt()).isZero();
    assertThat(created.path("displayMode").asText()).isEqualTo("BLIND");

    long quizId = created.path("id").asLong();
    JsonNode reset =
        putJson("/api/quizzes/" + quizId, owner, Map.of("title", "Still Bare"), 200).path("data");
    assertThat(reset.path("orderIndex").asInt()).isZero();
    assertThat(reset.path("displayMode").asText()).isEqualTo("BLIND");
  }

  /**
   * Verifies that a question created without an order index, question type, or per-option ordering
   * defaults to order 0, SINGLE_SELECT, and positional option indexes.
   */
  @Test
  void questionOmittingOrderIndexTypeAndOptionOrderingUsesPositionalDefaults() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Question Defaults Event");
    long quizId = createQuiz(owner, eventId, "Question Defaults Quiz");

    JsonNode created =
        postJson(
                "/api/quizzes/" + quizId + "/questions",
                owner,
                Map.of(
                    "text",
                    "Bare question",
                    "timeLimitSeconds",
                    20,
                    "options",
                    unorderedOptions("Right", 10, "Wrong", 0)),
                201)
            .path("data");

    assertThat(created.path("orderIndex").asInt()).isZero();
    assertThat(created.path("questionType").asText()).isEqualTo("SINGLE_SELECT");
    assertThat(created.path("options").get(0).path("orderIndex").asInt()).isZero();
    assertThat(created.path("options").get(1).path("orderIndex").asInt()).isEqualTo(1);

    // Updating with the same bare payload must merge onto the positional indexes, not duplicate.
    long questionId = created.path("id").asLong();
    JsonNode updated =
        putJson(
                "/api/questions/" + questionId,
                owner,
                Map.of(
                    "text",
                    "Bare question, edited",
                    "timeLimitSeconds",
                    25,
                    "options",
                    unorderedOptions("Still right", 10, "Still wrong", 0)),
                200)
            .path("data");
    assertThat(updated.path("orderIndex").asInt()).isZero();
    assertThat(updated.path("questionType").asText()).isEqualTo("SINGLE_SELECT");
    assertThat(updated.path("options")).hasSize(2);
    assertThat(updated.path("options").get(0).path("text").asText()).isEqualTo("Still right");
  }

  /**
   * Verifies that a passage without an explicit timer mode defaults to PER_SUB_QUESTION and carries
   * no passage-level time limit, and that its sub-questions must then each define their own.
   */
  @Test
  void passageOmittingTimerModeDefaultsToPerSubQuestionAndRequiresSubQuestionTimers()
      throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Passage Defaults Event");
    long quizId = createQuiz(owner, eventId, "Passage Defaults Quiz");

    JsonNode created =
        postJson(
                "/api/quizzes/" + quizId + "/passages",
                owner,
                Map.of(
                    "text",
                    "Bare passage",
                    "subQuestions",
                    List.of(timedSubQuestion("Sub with its own timer", 15))),
                201)
            .path("data");

    assertThat(created.path("orderIndex").asInt()).isZero();
    assertThat(created.path("timerMode").asText()).isEqualTo("PER_SUB_QUESTION");
    assertThat(created.path("timeLimitSeconds").isNull())
        .as("a PER_SUB_QUESTION passage must not carry a passage-level timer")
        .isTrue();
    assertThat(created.path("subQuestions").get(0).path("timeLimitSeconds").asInt()).isEqualTo(15);

    // The same passage shape without a sub-question timer is refused.
    JsonNode missingTimer =
        postJson(
            "/api/quizzes/" + quizId + "/passages",
            owner,
            Map.of(
                "text",
                "Untimed sub-questions",
                "orderIndex",
                1,
                "subQuestions",
                List.of(untimedSubQuestion("Sub without a timer"))),
            400);
    assertThat(missingTimer.path("error").path("message").asText())
        .isEqualTo("PER_SUB_QUESTION passage sub-questions must define timeLimitSeconds");
  }

  /**
   * Verifies that updating a passage without a timer mode drops it back to PER_SUB_QUESTION and
   * clears the passage-level time limit that ENTIRE_PASSAGE had set.
   */
  @Test
  void passageUpdateOmittingTimerModeClearsTheEntirePassageTimer() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Passage Update Event");
    long quizId = createQuiz(owner, eventId, "Passage Update Quiz");

    // An ENTIRE_PASSAGE sub-question may carry its own explicit timer, which is kept as given.
    long passageId =
        postJson(
                "/api/quizzes/" + quizId + "/passages",
                owner,
                Map.of(
                    "text",
                    "Timed block",
                    "orderIndex",
                    1,
                    "timerMode",
                    "ENTIRE_PASSAGE",
                    "timeLimitSeconds",
                    90,
                    "subQuestions",
                    List.of(timedSubQuestion("Sub with explicit timer", 12))),
                201)
            .path("data")
            .path("id")
            .asLong();

    JsonNode relaxed =
        putJson("/api/passages/" + passageId, owner, Map.of("text", "Untimed block"), 200)
            .path("data");
    assertThat(relaxed.path("orderIndex").asInt()).isZero();
    assertThat(relaxed.path("timerMode").asText()).isEqualTo("PER_SUB_QUESTION");
    assertThat(relaxed.path("timeLimitSeconds").isNull()).isTrue();
  }

  /**
   * Verifies the two question rules that sit either side of the optional fields: a standalone
   * question must state its own time limit, and no question may be edited once a session exists.
   */
  @Test
  void standaloneQuestionsRequireATimerAndAreFrozenOnceASessionExists() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Question Rules Event");
    long quizId = createQuiz(owner, eventId, "Question Rules Quiz");

    JsonNode missingTimer =
        postJson(
            "/api/quizzes/" + quizId + "/questions",
            owner,
            Map.of("text", "No timer", "options", unorderedOptions("Right", 10, "Wrong", 0)),
            400);
    assertThat(missingTimer.path("error").path("message").asText())
        .isEqualTo("Questions must define timeLimitSeconds");

    long questionId =
        createSingleSelectQuestion(owner, quizId, "Editable for now", 1, 20).path("id").asLong();
    postJson("/api/sessions", owner, Map.of("quizId", quizId), 201);

    JsonNode locked =
        putJson(
            "/api/questions/" + questionId,
            owner,
            Map.of(
                "text",
                "Edited mid-session",
                "orderIndex",
                1,
                "timeLimitSeconds",
                20,
                "questionType",
                "SINGLE_SELECT",
                "options",
                options("Right", 0, 10, "Wrong", 1, 0)),
            409);
    assertThat(locked.path("error").path("message").asText())
        .isEqualTo("Quiz has an active session and cannot be edited.");
  }

  private static Object unorderedOptions(String a, int aPoints, String b, int bPoints) {
    return List.of(
        Map.of("text", a, "pointValue", aPoints), Map.of("text", b, "pointValue", bPoints));
  }

  private static Map<String, Object> timedSubQuestion(String text, int seconds) {
    return Map.of(
        "text",
        text,
        "orderIndex",
        0,
        "timeLimitSeconds",
        seconds,
        "questionType",
        "SINGLE_SELECT",
        "options",
        options("Right", 0, 10, "Wrong", 1, 0));
  }

  private static Map<String, Object> untimedSubQuestion(String text) {
    return Map.of(
        "text",
        text,
        "orderIndex",
        0,
        "questionType",
        "SINGLE_SELECT",
        "options",
        options("Right", 0, 10, "Wrong", 1, 0));
  }
}
