package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for writing quizzes: quizzes that need no event, the sample quiz, duplicating a
 * question or a whole quiz, reordering, and rehearsals staying out of the quiz's history.
 */
class AuthoringIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that a quiz made without an event lands in the organiser's own quizzes, shows in the
   * quiz list, and that the catch-all event behind it never shows as an event.
   */
  @Test
  void aQuizNeedsNoEventAndTheCatchAllStaysOutOfTheEventList() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Trivia Night");
    createQuiz(organiser, eventId, "Round one");

    JsonNode loose =
        postJson("/api/quizzes", organiser, Map.of("title", "  Pop quiz  "), 201).path("data");
    assertThat(loose.path("title").asText()).isEqualTo("Pop quiz");
    assertThat(loose.path("defaultEvent").asBoolean()).isTrue();
    postJson("/api/quizzes", organiser, Map.of("title", "Another"), 201);

    JsonNode quizzes = getJson("/api/quizzes", organiser, 200).path("data");
    assertThat(quizzes)
        .extracting(quiz -> quiz.path("title").asText())
        .containsExactlyInAnyOrder("Round one", "Pop quiz", "Another");
    assertThat(quizzes)
        .filteredOn(quiz -> quiz.path("title").asText().equals("Round one"))
        .first()
        .satisfies(quiz -> assertThat(quiz.path("eventTitle").asText()).isEqualTo("Trivia Night"));

    JsonNode events = getJson("/api/events", organiser, 200).path("data");
    assertThat(events)
        .extracting(event -> event.path("title").asText())
        .containsExactly("Trivia Night");
  }

  /** Verifies that the sample quiz arrives complete and can be run straight away. */
  @Test
  void theSampleQuizIsReadyToRun() throws Exception {
    Auth organiser = organiser();
    JsonNode sample = postJson("/api/quizzes/sample", organiser, Map.of(), 201).path("data");
    assertThat(sample.path("questions")).hasSize(4);
    assertThat(sample.path("passages")).hasSize(1);
    assertThat(sample.path("passages").get(0).path("subQuestions")).hasSize(2);

    postJson("/api/sessions", organiser, Map.of("quizId", sample.path("id").asLong()), 201);
  }

  /**
   * Verifies that a duplicated question lands right after its original, pushing the rest down, and
   * that a duplicated quiz copies every passage, question and option.
   */
  @Test
  void duplicatesLandBesideTheirOriginal() throws Exception {
    Auth organiser = organiser();
    long quizId = createQuiz(organiser, createEvent(organiser, "Copies"), "Original");
    long first = createSingleSelectQuestion(organiser, quizId, "First", 0, 30).path("id").asLong();
    createSingleSelectQuestion(organiser, quizId, "Second", 1, 30);

    JsonNode quiz =
        postJson("/api/questions/" + first + "/duplicate", organiser, Map.of(), 201).path("data");
    assertThat(byOrder(quiz.path("questions")))
        .extracting(question -> question.path("text").asText())
        .containsExactly("First", "First", "Second");

    JsonNode copy =
        postJson("/api/quizzes/" + quizId + "/duplicate", organiser, Map.of(), 201).path("data");
    assertThat(copy.path("title").asText()).isEqualTo("Original (copy)");
    assertThat(copy.path("id").asLong()).isNotEqualTo(quizId);
    assertThat(byOrder(copy.path("questions")))
        .extracting(question -> question.path("text").asText())
        .containsExactly("First", "First", "Second");
    assertThat(copy.path("questions").get(0).path("options")).hasSize(2);
  }

  /**
   * Verifies that a reorder sets the running order, and that one missing a block is refused rather
   * than applied.
   */
  @Test
  void reorderingSetsTheRunningOrderAndRefusesAStaleList() throws Exception {
    Auth organiser = organiser();
    long quizId = createQuiz(organiser, createEvent(organiser, "Order"), "Order Quiz");
    long a = createSingleSelectQuestion(organiser, quizId, "A", 0, 30).path("id").asLong();
    long b = createSingleSelectQuestion(organiser, quizId, "B", 1, 30).path("id").asLong();
    long c = createSingleSelectQuestion(organiser, quizId, "C", 2, 30).path("id").asLong();

    JsonNode quiz =
        putJson(
                "/api/quizzes/" + quizId + "/order",
                organiser,
                Map.of("blocks", List.of(block(c), block(a), block(b))),
                200)
            .path("data");
    assertThat(byOrder(quiz.path("questions")))
        .extracting(question -> question.path("text").asText())
        .containsExactly("C", "A", "B");

    putJson(
        "/api/quizzes/" + quizId + "/order",
        organiser,
        Map.of("blocks", List.of(block(a), block(b))),
        409);
  }

  /** Verifies that a finished rehearsal is left out of the quiz's past sessions. */
  @Test
  void aFinishedRehearsalLeavesNoTrace() throws Exception {
    Auth organiser = organiser();
    long quizId = createQuiz(organiser, createEvent(organiser, "Rehearse"), "Run-through");
    createSingleSelectQuestion(organiser, quizId, "Only", 0, 30);

    JsonNode rehearsal =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId, "rehearsal", true), 201)
            .path("data");
    long sessionId = rehearsal.path("id").asLong();
    assertThat(rehearsal.path("rehearsal").asBoolean()).isTrue();
    assertThat(
            getJson("/api/sessions/" + sessionId + "/lobby", organiser, 200)
                .path("data")
                .path("rehearsal")
                .asBoolean())
        .isTrue();
    assertThat(getJson("/api/quizzes/" + quizId + "/sessions", organiser, 200).path("data"))
        .hasSize(1);

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    assertThat(getJson("/api/quizzes/" + quizId + "/sessions", organiser, 200).path("data"))
        .isEmpty();
  }

  private static Map<String, Object> block(long questionId) {
    return Map.of("kind", "QUESTION", "id", questionId);
  }

  private static List<JsonNode> byOrder(JsonNode questions) {
    return questions
        .valueStream()
        .sorted(
            (x, y) -> Integer.compare(x.path("orderIndex").asInt(), y.path("orderIndex").asInt()))
        .toList();
  }
}
