package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for scoring correction and leaderboard ordering.
 *
 * <p>This suite exercises the API path that allows hosts to revise scoring after answers have
 * already been persisted, and verifies that score ties are resolved by cumulative answer time —
 * identically during play and in the final results.
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
   * Verifies that a correction which accepts a second answer on a single-select question leaves
   * both answers marked correct. A player can only ever pick one option there, so everyone who
   * chose either scoring option got it right — nobody should see "incorrect" beside points they
   * were just awarded.
   */
  @Test
  void acceptingASecondAnswerOnASingleSelectQuestionMarksBothAnswersCorrect() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Two Right Answers Event");
    long quizId = createQuiz(organiser, eventId, "Two Right Answers Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Ambiguous", 1, 30);
    long questionId = question.path("id").asLong();
    long originalOptionId = question.path("options").get(0).path("id").asLong();
    long otherOptionId = question.path("options").get(1).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String joinCode = session.path("joinCode").asText();
    String adaToken = join(joinCode, "Ada");
    String graceToken = join(joinCode, "Grace");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    answer(sessionId, adaToken, questionId, originalOptionId);
    answer(sessionId, graceToken, questionId, otherOptionId);
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);

    // The host decides the other option was a fair answer too
    patchJson(
        "/api/sessions/" + sessionId + "/questions/" + questionId + "/scoring",
        organiser,
        Map.of(
            "options",
            new Object[] {
              Map.of("optionId", originalOptionId, "pointValue", 10),
              Map.of("optionId", otherOptionId, "pointValue", 10)
            }),
        200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    for (String token : List.of(adaToken, graceToken)) {
      JsonNode mine = myResults(sessionId, token);
      assertThat(mine.path("correctCount").asInt()).isEqualTo(1);
      assertThat(mine.path("questions").get(0).path("isCorrect").asBoolean()).isTrue();
      assertThat(mine.path("questions").get(0).path("pointsEarned").asInt()).isEqualTo(10);
    }
  }

  /**
   * Verifies that two participants level on score are separated by who answered faster, and that
   * every screen agrees on it: the live leaderboard, the organiser's results page once the session
   * has ended, and each player's own results. Grace joins first so that join order alone would put
   * her on top — only the answer time can rank Ada above her.
   */
  @Test
  void scoreTiesAreBrokenByAnswerTimeOnTheLiveBoardAndInTheFinalResults() throws Exception {
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
    String graceToken = join(joinCode, "Grace");
    String adaToken = join(joinCode, "Ada");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);

    answer(sessionId, adaToken, questionId, correctOptionId);
    // Grace gives the same correct answer measurably later than Ada
    Thread.sleep(500);
    answer(sessionId, graceToken, questionId, correctOptionId);

    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);

    JsonNode live =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200)
            .path("data")
            .path("leaderboard");
    assertAdaAheadOfGrace(live);

    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    JsonNode finalBoard =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200)
            .path("data")
            .path("leaderboard");
    assertAdaAheadOfGrace(finalBoard);

    assertThat(myRank(sessionId, adaToken)).isEqualTo(1);
    assertThat(myRank(sessionId, graceToken)).isEqualTo(2);
  }

  private static void assertAdaAheadOfGrace(JsonNode leaderboard) {
    assertThat(leaderboard).hasSize(2);
    assertThat(leaderboard.get(0).path("displayName").asText()).isEqualTo("Ada");
    assertThat(leaderboard.get(0).path("rank").asInt()).isEqualTo(1);
    assertThat(leaderboard.get(0).path("score").asLong()).isEqualTo(10);
    assertThat(leaderboard.get(1).path("displayName").asText()).isEqualTo("Grace");
    assertThat(leaderboard.get(1).path("rank").asInt()).isEqualTo(2);
    assertThat(leaderboard.get(1).path("score").asLong()).isEqualTo(10);
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

  private JsonNode myResults(long sessionId, String token) throws Exception {
    return getJson(
            "/api/sessions/" + sessionId + "/my-results",
            null,
            Map.of("X-Rejoin-Token", token),
            200)
        .path("data");
  }

  private int myRank(long sessionId, String token) throws Exception {
    return myResults(sessionId, token).path("rank").asInt();
  }
}
