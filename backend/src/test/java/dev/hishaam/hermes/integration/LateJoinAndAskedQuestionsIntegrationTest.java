package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for what a room sees when people arrive late or the host stops early.
 *
 * <p>A player can join a session that is already running and take part from the question on screen;
 * results only count questions whose answers were opened; and a reconnect during the review shows
 * each player their own graded score along with the session's scoring rules.
 */
class LateJoinAndAskedQuestionsIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that a player who joins after the start lands on the question on screen and can answer
   * it, and that the code stops working once the session ends.
   */
  @Test
  void aLatecomerJoinsTheRunningSessionAtTheQuestionOnScreen() throws Exception {
    Auth organiser = organiser();
    long quizId = createQuiz(organiser, createEvent(organiser, "Late Event"), "Late Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Only question", 1, 30);
    long questionId = question.path("id").asLong();
    long correctOptionId = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String joinCode = session.path("joinCode").asText();
    join(joinCode, "Early");
    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);

    String lateToken = join(joinCode, "Late");
    JsonNode rejoin = rejoin(sessionId, lateToken);
    assertThat(rejoin.path("status").asText()).isEqualTo("ACTIVE");
    assertThat(rejoin.path("participantCount").asInt()).isEqualTo(2);
    assertThat(rejoin.path("currentQuestion").path("id").asLong()).isEqualTo(questionId);

    answer(sessionId, lateToken, questionId, correctOptionId);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    JsonNode afterEnd =
        postJson(
            "/api/sessions/join",
            null,
            Map.of("joinCode", joinCode, "displayName", "Too late"),
            404);
    assertThat(afterEnd.path("error").path("message").asText())
        .isEqualTo("Invalid or expired join code");
    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(results.path("leaderboard").get(0).path("displayName").asText()).isEqualTo("Late");
  }

  /**
   * Verifies that when the host ends after the first of two questions, the second reads as not
   * asked for both the organiser and the player, and the player's tally is out of one, not two.
   */
  @Test
  void questionsNeverOpenedAreReportedAsNotAsked() throws Exception {
    Auth organiser = organiser();
    long quizId = createQuiz(organiser, createEvent(organiser, "Early End Event"), "Early End");
    JsonNode first = createSingleSelectQuestion(organiser, quizId, "First", 1, 30);
    createSingleSelectQuestion(organiser, quizId, "Second", 2, 30);

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session.path("joinCode").asText(), "Ada");
    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    answer(
        sessionId,
        token,
        first.path("id").asLong(),
        first.path("options").get(0).path("id").asLong());
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(results.path("questionsAsked").asInt()).isEqualTo(1);
    assertThat(results.path("questions").get(0).path("asked").asBoolean()).isTrue();
    assertThat(results.path("questions").get(1).path("asked").asBoolean()).isFalse();

    JsonNode mine =
        getJson(
                "/api/sessions/" + sessionId + "/my-results",
                null,
                Map.of("X-Rejoin-Token", token),
                200)
            .path("data");
    assertThat(mine.path("questionsAsked").asInt()).isEqualTo(1);
    assertThat(mine.path("totalQuestions").asInt()).isEqualTo(2);
    assertThat(mine.path("correctCount").asInt()).isEqualTo(1);
    assertThat(mine.path("questions").get(1).path("asked").asBoolean()).isFalse();
  }

  /**
   * Verifies that a player who reconnects while a question is being reviewed gets the score they
   * were graded, and is told up front that the quiz has penalty options.
   */
  @Test
  void aReconnectDuringTheReviewCarriesTheGradedScoreAndTheRules() throws Exception {
    Auth organiser = organiser();
    long quizId = createQuiz(organiser, createEvent(organiser, "Partial Event"), "Partial Quiz");
    JsonNode question = createMultiSelectQuestion(organiser, quizId, "Pick both", 1, 30);
    long questionId = question.path("id").asLong();
    long firstCorrect = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session.path("joinCode").asText(), "Ada");

    JsonNode lobby = rejoin(sessionId, token);
    assertThat(lobby.path("scoring").path("penalties").asBoolean()).isTrue();
    assertThat(lobby.path("scoring").path("speedScoring").asBoolean()).isFalse();

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    answer(sessionId, token, questionId, firstCorrect);
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);

    JsonNode review = rejoin(sessionId, token);
    assertThat(review.path("myScores").path(String.valueOf(questionId)).asInt()).isEqualTo(5);
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

  private JsonNode rejoin(long sessionId, String token) throws Exception {
    return postJson(
            "/api/sessions/rejoin", null, Map.of("rejoinToken", token, "sessionId", sessionId), 200)
        .path("data");
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
