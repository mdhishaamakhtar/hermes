package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for the host's control of the room: the lobby roster, removing a player, and
 * cutting the big screen to the standings between questions.
 */
class StagingIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that the lobby lists players in the order they arrived, and that removing one during a
   * live question takes their pick out of the tallies, their name off the roster, and their token
   * out of service.
   */
  @Test
  void removingAPlayerTakesTheirPickNameAndTokenWithThem() throws Exception {
    Auth organiser = organiser();
    long quizId = createQuiz(organiser, createEvent(organiser, "Roster Event"), "Roster Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Pick", 1, 30);
    long questionId = question.path("id").asLong();
    long correctOptionId = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String joinCode = session.path("joinCode").asText();
    String adaToken = join(joinCode, "Ada");
    String trollToken = join(joinCode, "Rude name");

    JsonNode lobby = getJson("/api/sessions/" + sessionId + "/lobby", organiser, 200).path("data");
    assertThat(lobby.path("players"))
        .extracting(player -> player.path("displayName").asText())
        .containsExactly("Ada", "Rude name");
    long trollId = lobby.path("players").get(1).path("participantId").asLong();

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    answer(sessionId, adaToken, questionId, correctOptionId);
    answer(sessionId, trollToken, questionId, correctOptionId);

    deleteJson("/api/sessions/" + sessionId + "/participants/" + trollId, organiser, 200);

    JsonNode sync =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(sync.path("participantCount").asInt()).isEqualTo(1);
    JsonNode stats = sync.path("questionStatsById").path(String.valueOf(questionId));
    assertThat(stats.path("totalAnswered").asLong()).isEqualTo(1);
    assertThat(stats.path("counts").path(String.valueOf(correctOptionId)).asLong()).isEqualTo(1);
    assertThat(
            getJson("/api/sessions/" + sessionId + "/lobby", organiser, 200)
                .path("data")
                .path("players"))
        .extracting(player -> player.path("displayName").asText())
        .containsExactly("Ada");
    postJson(
        "/api/sessions/rejoin",
        null,
        Map.of("rejoinToken", trollToken, "sessionId", sessionId),
        404);
  }

  /**
   * Verifies that the standings can only go up on the big screen once the question is reviewed,
   * that the scene survives a host resync, and that the next question cuts back.
   */
  @Test
  void standingsGoUpAfterTheReviewAndTheNextQuestionCutsBack() throws Exception {
    Auth organiser = organiser();
    long quizId = createQuiz(organiser, createEvent(organiser, "Scene Event"), "Scene Quiz");
    createSingleSelectQuestion(organiser, quizId, "First", 1, 30);
    createSingleSelectQuestion(organiser, quizId, "Second", 2, 30);

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    join(session.path("joinCode").asText(), "Ada");
    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);

    JsonNode early =
        putJson(
            "/api/sessions/" + sessionId + "/scene", organiser, Map.of("scene", "STANDINGS"), 409);
    assertThat(early.path("error").path("message").asText())
        .isEqualTo("Standings can go up once the question is reviewed");

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    putJson("/api/sessions/" + sessionId + "/scene", organiser, Map.of("scene", "STANDINGS"), 200);
    assertThat(
            getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200)
                .path("data")
                .path("scene")
                .asText())
        .isEqualTo("STANDINGS");

    postJson("/api/sessions/" + sessionId + "/next", organiser, Map.of(), 200);
    assertThat(
            getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200)
                .path("data")
                .path("scene")
                .asText())
        .isEqualTo("QUESTION");
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
