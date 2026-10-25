package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for the two newer formats: a poll, which has no right answer and scores
 * nothing, and speed scoring, under which a right answer earns at most its points and never less
 * than half of them.
 */
class PollAndSpeedScoringIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that a poll saves with no answer key whatever points it is sent, scores nobody, and is
   * marked as a poll on the results; and that a speed-scored right answer lands between half and
   * all of its points, with the rule announced to the host.
   */
  @Test
  void aPollScoresNobodyAndSpeedScoringKeepsBetweenHalfAndAllThePoints() throws Exception {
    Auth organiser = organiser();
    long quizId = createQuiz(organiser, createEvent(organiser, "Formats"), "Formats Quiz");
    putJson(
        "/api/quizzes/" + quizId,
        organiser,
        Map.of("title", "Formats Quiz", "displayMode", "LIVE", "speedScoring", true),
        200);

    JsonNode poll =
        postJson(
                "/api/quizzes/" + quizId + "/questions",
                organiser,
                Map.of(
                    "text",
                    "Tea or coffee?",
                    "orderIndex",
                    0,
                    "timeLimitSeconds",
                    20,
                    "questionType",
                    "SINGLE_SELECT",
                    "poll",
                    true,
                    "options",
                    options("Tea", 0, 10, "Coffee", 1, 0)),
                201)
            .path("data");
    assertThat(poll.path("poll").asBoolean()).isTrue();
    assertThat(poll.path("options"))
        .allSatisfy(option -> assertThat(option.path("pointValue").asInt()).isZero());
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Scored", 1, 20);

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session.path("joinCode").asText(), "Ada");
    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);

    JsonNode sync = getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200);
    assertThat(sync.path("data").path("scoring").path("speedScoring").asBoolean()).isTrue();
    assertThat(sync.path("data").path("currentQuestion").path("poll").asBoolean()).isTrue();

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    answer(
        sessionId,
        token,
        poll.path("id").asLong(),
        poll.path("options").get(0).path("id").asLong());
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/next", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    answer(
        sessionId,
        token,
        question.path("id").asLong(),
        question.path("options").get(0).path("id").asLong());
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    JsonNode mine =
        getJson(
                "/api/sessions/" + sessionId + "/my-results",
                null,
                Map.of("X-Rejoin-Token", token),
                200)
            .path("data");
    JsonNode pollResult = mine.path("questions").get(0);
    assertThat(pollResult.path("poll").asBoolean()).isTrue();
    assertThat(pollResult.path("pointsEarned").asInt()).isZero();
    assertThat(pollResult.path("isCorrect").asBoolean()).isFalse();
    assertThat(mine.path("questions").get(1).path("pointsEarned").asInt()).isBetween(5, 10);
    assertThat(mine.path("correctCount").asInt()).isEqualTo(1);
  }

  private String join(String joinCode, String displayName) throws Exception {
    return postJson(
            "/api/sessions/join",
            null,
            Map.of("joinCode", joinCode, "displayName", displayName),
            200)
        .path("data")
        .path("rejoinToken")
        .asText();
  }

  private void answer(long sessionId, String token, long questionId, long optionId)
      throws Exception {
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken", token, "questionId", questionId, "selectedOptionIds", List.of(optionId)),
        200);
  }
}
