package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Integration tests for scoring correction and leaderboard ordering.
 *
 * <p>This suite exercises the API path that allows hosts to revise scoring after answers have
 * already been persisted, and verifies that score ties are resolved by cumulative answer time.
 */
class ScoringAndLeaderboardIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that scoring correction is rejected before the session reaches a reviewable state and
   * that missing questions return a not-found response.
   */
  @Test
  void scoringCorrectionIsRejectedOutsideReviewAndEndedStates() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Correction Guard Event");
    long quizId = createQuiz(organiser, eventId, "Correction Guard Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Guarded", 1, 30);
    long questionId = question.path("id").asLong();
    long correctOptionId = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String scoringUrl = "/api/sessions/" + sessionId + "/questions/" + questionId + "/scoring";
    Object correction =
        Map.of("options", new Object[] {Map.of("optionId", correctOptionId, "pointValue", 0)});

    JsonNode inLobby = patchJson(scoringUrl, organiser, correction, 409);
    assertThat(inLobby.path("error").path("message").asText())
        .isEqualTo("Scoring can only be corrected while reviewing or after session ends");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    JsonNode whileDisplayed = patchJson(scoringUrl, organiser, correction, 409);
    assertThat(whileDisplayed.path("error").path("message").asText())
        .isEqualTo("Scoring can only be corrected while reviewing or after session ends");

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    JsonNode whileTimed = patchJson(scoringUrl, organiser, correction, 409);
    assertThat(whileTimed.path("error").path("message").asText())
        .isEqualTo("Scoring can only be corrected while reviewing or after session ends");

    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    JsonNode unknownQuestion =
        patchJson(
            "/api/sessions/" + sessionId + "/questions/" + (questionId + 999) + "/scoring",
            organiser,
            correction,
            404);
    assertThat(unknownQuestion.path("error").path("message").asText())
        .isEqualTo("Question not found in session snapshot");
  }

  /**
   * Verifies that correcting scoring after the session ends regrades stored answers and updates
   * both the session results and per-participant results endpoints.
   */
  @Test
  void scoringCorrectionAfterSessionEndRegradesPersistedResults() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Post-End Correction Event");
    long quizId = createQuiz(organiser, eventId, "Post-End Correction Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Disputed answer", 1, 30);
    long questionId = question.path("id").asLong();
    long correctOptionId = question.path("options").get(0).path("id").asLong();
    long wrongOptionId = question.path("options").get(1).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    JsonNode participant =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Ada"),
                200)
            .path("data");
    String rejoinToken = participant.path("rejoinToken").asText();

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken",
            rejoinToken,
            "questionId",
            questionId,
            "selectedOptionIds",
            List.of(wrongOptionId)),
        200);
    postJson(
        "/api/sessions/" + sessionId + "/lock-in",
        null,
        Map.of("rejoinToken", rejoinToken, "questionId", questionId),
        200);
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    JsonNode beforeCorrection =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(beforeCorrection.path("leaderboard").get(0).path("score").asLong()).isZero();

    // Host realises the answer key was wrong after the session already ended
    patchJson(
        "/api/sessions/" + sessionId + "/questions/" + questionId + "/scoring",
        organiser,
        Map.of(
            "options",
            new Object[] {
              Map.of("optionId", correctOptionId, "pointValue", 0),
              Map.of("optionId", wrongOptionId, "pointValue", 10)
            }),
        200);

    JsonNode afterCorrection =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(afterCorrection.path("leaderboard").get(0).path("displayName").asText())
        .isEqualTo("Ada");
    assertThat(afterCorrection.path("leaderboard").get(0).path("score").asLong()).isEqualTo(10);

    JsonNode myResults =
        getJson(
                "/api/sessions/" + sessionId + "/my-results",
                null,
                Map.of("X-Rejoin-Token", rejoinToken),
                200)
            .path("data");
    assertThat(myResults.path("score").asInt()).isEqualTo(10);
    assertThat(myResults.path("questions").get(0).path("pointsEarned").asInt()).isEqualTo(10);
  }

  /**
   * Verifies that leaderboard ranking prefers participants with the same score who answered faster
   * overall.
   */
  @Test
  void leaderboardBreaksScoreTiesByFasterCumulativeAnswerTime() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Tie Break Event");
    long quizId = createQuiz(organiser, eventId, "Tie Break Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Speed matters", 1, 30);
    long questionId = question.path("id").asLong();
    long correctOptionId = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String joinCode = session.path("joinCode").asText();
    String adaToken =
        postJson(
                "/api/sessions/join", null, Map.of("joinCode", joinCode, "displayName", "Ada"), 200)
            .path("data")
            .path("rejoinToken")
            .asText();
    String graceToken =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", joinCode, "displayName", "Grace"),
                200)
            .path("data")
            .path("rejoinToken")
            .asText();

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);

    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken",
            adaToken,
            "questionId",
            questionId,
            "selectedOptionIds",
            List.of(correctOptionId)),
        200);
    // Grace gives the same correct answer measurably later than Ada
    Thread.sleep(500);
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken",
            graceToken,
            "questionId",
            questionId,
            "selectedOptionIds",
            List.of(correctOptionId)),
        200);

    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);

    JsonNode leaderboard =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200)
            .path("data")
            .path("leaderboard");
    assertThat(leaderboard).hasSize(2);
    assertThat(leaderboard.get(0).path("displayName").asText()).isEqualTo("Ada");
    assertThat(leaderboard.get(0).path("rank").asInt()).isEqualTo(1);
    assertThat(leaderboard.get(0).path("score").asLong()).isEqualTo(10);
    assertThat(leaderboard.get(1).path("displayName").asText()).isEqualTo("Grace");
    assertThat(leaderboard.get(1).path("rank").asInt()).isEqualTo(2);
    assertThat(leaderboard.get(1).path("score").asLong()).isEqualTo(10);
  }
}
