package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Integration tests for lifecycle guardrails on sessions.
 *
 * <p>This suite focuses on invalid or out-of-order transitions: creation rules, double-starts, late
 * joins, timer state checks, and automatic session ending when the final question is completed.
 */
class SessionLifecycleGuardsIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that session creation and lifecycle transitions are rejected when the quiz is empty or
   * when the host attempts to move the session out of order.
   */
  @Test
  void sessionRejectsCreationWithoutQuestionsAndOutOfOrderTransitions() throws Exception {
    Auth organiser = organiser();
    long emptyEventId = createEvent(organiser, "Empty Quiz Event");
    long emptyQuizId = createQuiz(organiser, emptyEventId, "Empty Quiz");
    JsonNode emptyQuiz = postJson("/api/sessions", organiser, Map.of("quizId", emptyQuizId), 400);
    assertThat(emptyQuiz.path("error").path("message").asText())
        .isEqualTo("Quiz must have at least one question");

    long eventId = createEvent(organiser, "Transitions Event");
    long quizId = createQuiz(organiser, eventId, "Transitions Quiz");
    createSingleSelectQuestion(organiser, quizId, "Only question", 1, 30);

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String joinCode = session.path("joinCode").asText();

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    JsonNode doubleStart =
        postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 409);
    assertThat(doubleStart.path("error").path("message").asText())
        .isEqualTo("Session is not in LOBBY state");

    JsonNode joinAfterStart =
        postJson(
            "/api/sessions/join", null, Map.of("joinCode", joinCode, "displayName", "Late"), 409);
    assertThat(joinAfterStart.path("error").path("message").asText())
        .isEqualTo("Session is no longer accepting participants");

    JsonNode endTimerWhileDisplayed =
        postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 409);
    assertThat(endTimerWhileDisplayed.path("error").path("message").asText())
        .isEqualTo("Timer can only be ended while question is in TIMED state");

    JsonNode advanceWhileDisplayed =
        postJson("/api/sessions/" + sessionId + "/next", organiser, Map.of(), 409);
    assertThat(advanceWhileDisplayed.path("error").path("message").asText())
        .isEqualTo("Cannot advance: current question is not in REVIEWING state");

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    JsonNode doubleStartTimer =
        postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 409);
    assertThat(doubleStartTimer.path("error").path("message").asText())
        .isEqualTo("Timer can only be started when question is in DISPLAYED state");
  }

  /**
   * Verifies that advancing past the final reviewed question closes the session and produces final
   * results instead of leaving the session stranded.
   */
  @Test
  void advancingPastTheFinalReviewedQuestionEndsTheSession() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Auto End Event");
    long quizId = createQuiz(organiser, eventId, "Auto End Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Final question", 1, 30);
    long questionId = question.path("id").asLong();
    long correctOptionId = question.path("options").get(0).path("id").asLong();

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
            List.of(correctOptionId)),
        200);
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);

    postJson("/api/sessions/" + sessionId + "/next", organiser, Map.of(), 200);

    assertThat(
            getJson("/api/sessions/" + sessionId + "/status", organiser, 200).path("data").asText())
        .isEqualTo("ENDED");
    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(results.path("participantCount").asLong()).isEqualTo(1);
    assertThat(results.path("leaderboard").get(0).path("displayName").asText()).isEqualTo("Ada");
    assertThat(results.path("leaderboard").get(0).path("score").asLong()).isEqualTo(10);
  }

  /**
   * Verifies that ending a session while a question is still timed freezes the live answer state,
   * grades the question, and exposes the stored result to the participant.
   */
  @Test
  void endingSessionWhileQuestionIsTimedFreezesAndGradesUnlockedAnswers() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Abrupt End Event");
    long quizId = createQuiz(organiser, eventId, "Abrupt End Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Interrupted", 1, 30);
    long questionId = question.path("id").asLong();
    long correctOptionId = question.path("options").get(0).path("id").asLong();

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
    // Ada answers but never locks in; the host ends the session mid-timer
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken",
            rejoinToken,
            "questionId",
            questionId,
            "selectedOptionIds",
            List.of(correctOptionId)),
        200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    assertThat(
            getJson("/api/sessions/" + sessionId + "/status", organiser, 200).path("data").asText())
        .isEqualTo("ENDED");
    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(results.path("questions").get(0).path("totalAnswers").asLong()).isEqualTo(1);
    assertThat(results.path("leaderboard").get(0).path("displayName").asText()).isEqualTo("Ada");
    assertThat(results.path("leaderboard").get(0).path("score").asLong()).isEqualTo(10);

    JsonNode myResults =
        getJson(
                "/api/sessions/" + sessionId + "/my-results",
                null,
                Map.of("X-Rejoin-Token", rejoinToken),
                200)
            .path("data");
    assertThat(myResults.path("questions").get(0).path("pointsEarned").asInt()).isEqualTo(10);
  }

  /**
   * Verifies that only the session owner can drive control endpoints and that failed attempts do
   * not disturb the active session state.
   */
  @Test
  void sessionControlEndpointsRejectOrganisersWhoDoNotOwnTheSession() throws Exception {
    Auth owner = organiser();
    Auth intruder = organiser();
    long eventId = createEvent(owner, "Owned Event");
    long quizId = createQuiz(owner, eventId, "Owned Quiz");
    createSingleSelectQuestion(owner, quizId, "Question", 1, 30);

    JsonNode session = postJson("/api/sessions", owner, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();

    JsonNode forbiddenStart =
        postJson("/api/sessions/" + sessionId + "/start", intruder, Map.of(), 403);
    assertThat(forbiddenStart.path("error").path("code").asText()).isEqualTo("FORBIDDEN");
    assertThat(forbiddenStart.path("error").path("message").asText()).isEqualTo("Access denied");

    JsonNode forbiddenSync = getJson("/api/sessions/" + sessionId + "/host-sync", intruder, 403);
    assertThat(forbiddenSync.path("error").path("code").asText()).isEqualTo("FORBIDDEN");

    JsonNode forbiddenEnd =
        postJson("/api/sessions/" + sessionId + "/end", intruder, Map.of(), 403);
    assertThat(forbiddenEnd.path("error").path("code").asText()).isEqualTo("FORBIDDEN");

    // The failed attempts must not have disturbed the session: the owner can still run it
    postJson("/api/sessions/" + sessionId + "/start", owner, Map.of(), 200);
    assertThat(getJson("/api/sessions/" + sessionId + "/status", owner, 200).path("data").asText())
        .isEqualTo("ACTIVE");
  }
}
