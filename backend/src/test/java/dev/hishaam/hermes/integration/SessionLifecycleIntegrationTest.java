package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SessionLifecycleIntegrationTest extends BaseIntegrationTest {

  @Test
  void sessionFlowCoversJoinAnswerLockRejoinReviewCorrectionAndResults() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Live Event");
    long quizId = createQuiz(organiser, eventId, "Live Quiz");
    JsonNode q1 = createSingleSelectQuestion(organiser, quizId, "Question one", 1, 30);
    JsonNode q2 = createMultiSelectQuestion(organiser, quizId, "Question two", 2, 30);

    long q1Id = q1.path("id").asLong();
    long q1CorrectOptionId = q1.path("options").get(0).path("id").asLong();
    long q1WrongOptionId = q1.path("options").get(1).path("id").asLong();
    long q2Id = q2.path("id").asLong();
    long q2CorrectA = q2.path("options").get(0).path("id").asLong();
    long q2CorrectB = q2.path("options").get(1).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String joinCode = session.path("joinCode").asText();
    assertThat(session.path("status").asText()).isEqualTo("LOBBY");
    assertThat(joinCode).hasSize(6);

    JsonNode ada =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", joinCode.toLowerCase(), "displayName", "Ada"),
                200)
            .path("data");
    JsonNode grace =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", joinCode, "displayName", "Grace"),
                200)
            .path("data");
    String adaToken = ada.path("rejoinToken").asText();
    String graceToken = grace.path("rejoinToken").asText();

    JsonNode lobby = getJson("/api/sessions/" + sessionId + "/lobby", organiser, 200).path("data");
    assertThat(lobby.path("participantCount").asLong()).isEqualTo(2);

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    JsonNode hostSync =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(hostSync.path("status").asText()).isEqualTo("ACTIVE");
    assertThat(hostSync.path("questionLifecycle").asText()).isEqualTo("DISPLAYED");
    assertThat(hostSync.path("currentQuestion").path("id").asLong()).isEqualTo(q1Id);
    assertThat(hostSync.path("participantCount").asInt()).isEqualTo(2);

    JsonNode answerBeforeTimer =
        postJson(
            "/api/sessions/" + sessionId + "/answers",
            null,
            Map.of(
                "rejoinToken",
                adaToken,
                "questionId",
                q1Id,
                "selectedOptionIds",
                List.of(q1CorrectOptionId)),
            409);
    assertThat(answerBeforeTimer.path("error").path("message").asText())
        .isEqualTo("Question is not currently accepting answers");

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken",
            adaToken,
            "questionId",
            q1Id,
            "selectedOptionIds",
            List.of(q1CorrectOptionId),
            "clientRequestId",
            "ada-q1"),
        200);
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken",
            graceToken,
            "questionId",
            q1Id,
            "selectedOptionIds",
            List.of(q1WrongOptionId),
            "clientRequestId",
            "grace-q1"),
        200);
    postJson(
        "/api/sessions/" + sessionId + "/lock-in",
        null,
        Map.of("rejoinToken", adaToken, "questionId", q1Id, "clientRequestId", "ada-lock-q1"),
        200);
    postJson(
        "/api/sessions/" + sessionId + "/lock-in",
        null,
        Map.of("rejoinToken", graceToken, "questionId", q1Id, "clientRequestId", "grace-lock-q1"),
        200);

    JsonNode rejoin =
        postJson(
                "/api/sessions/rejoin",
                null,
                Map.of("rejoinToken", adaToken, "sessionId", sessionId),
                200)
            .path("data");
    assertThat(rejoin.path("questionLifecycle").asText()).isEqualTo("TIMED");
    assertThat(rejoin.path("currentQuestion").path("selectedOptionIds").get(0).asLong())
        .isEqualTo(q1CorrectOptionId);
    assertThat(rejoin.path("currentQuestion").path("lockedIn").asBoolean()).isTrue();

    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    JsonNode reviewing =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(reviewing.path("questionLifecycle").asText()).isEqualTo("REVIEWING");
    assertThat(
            reviewing
                .path("questionStatsById")
                .path(String.valueOf(q1Id))
                .path("totalAnswered")
                .asLong())
        .isEqualTo(2);
    assertThat(
            reviewing
                .path("questionStatsById")
                .path(String.valueOf(q1Id))
                .path("totalLockedIn")
                .asLong())
        .isEqualTo(2);

    JsonNode prematureResults = getJson("/api/sessions/" + sessionId + "/results", organiser, 409);
    assertThat(prematureResults.path("error").path("message").asText())
        .isEqualTo("Session has not ended yet");

    patchJson(
        "/api/sessions/" + sessionId + "/questions/" + q1Id + "/scoring",
        organiser,
        Map.of(
            "options",
            new Object[] {
              Map.of("optionId", q1CorrectOptionId, "pointValue", 0),
              Map.of("optionId", q1WrongOptionId, "pointValue", 10)
            }),
        200);

    JsonNode corrected =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(
            corrected
                .path("questionStatsById")
                .path(String.valueOf(q1Id))
                .path("optionPoints")
                .path(String.valueOf(q1WrongOptionId))
                .asInt())
        .isEqualTo(10);

    postJson("/api/sessions/" + sessionId + "/next", organiser, Map.of(), 200);
    JsonNode secondDisplayed =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(secondDisplayed.path("questionLifecycle").asText()).isEqualTo("DISPLAYED");
    assertThat(secondDisplayed.path("currentQuestion").path("id").asLong()).isEqualTo(q2Id);

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken",
            adaToken,
            "questionId",
            q2Id,
            "selectedOptionIds",
            List.of(q2CorrectA, q2CorrectB)),
        200);
    postJson(
        "/api/sessions/" + sessionId + "/lock-in",
        null,
        Map.of("rejoinToken", adaToken, "questionId", q2Id),
        200);

    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);
    assertThat(
            getJson("/api/sessions/" + sessionId + "/status", organiser, 200).path("data").asText())
        .isEqualTo("ENDED");

    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(results.path("participantCount").asLong()).isEqualTo(2);
    assertThat(results.path("questions")).hasSize(2);
    assertThat(results.path("questions").get(0).path("totalAnswers").asLong()).isEqualTo(2);
    assertThat(results.path("questions").get(1).path("totalAnswers").asLong()).isEqualTo(1);
    assertThat(scoreFor(results.path("leaderboard"), "Ada")).isEqualTo(10);
    assertThat(scoreFor(results.path("leaderboard"), "Grace")).isEqualTo(10);

    JsonNode myResults =
        getJson(
                "/api/sessions/" + sessionId + "/my-results",
                null,
                Map.of("X-Rejoin-Token", adaToken),
                200)
            .path("data");
    assertThat(myResults.path("displayName").asText()).isEqualTo("Ada");
    assertThat(myResults.path("score").asInt()).isEqualTo(10);
    assertThat(myResults.path("totalQuestions").asInt()).isEqualTo(2);
    assertThat(myResults.path("questions")).hasSize(2);
    assertThat(myResults.path("questions").get(0).path("pointsEarned").asInt()).isZero();
    assertThat(myResults.path("questions").get(1).path("pointsEarned").asInt()).isEqualTo(10);
  }

  @Test
  void sessionRejectsInvalidJoinCodeWrongQuestionAndLateQuizEdits() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Guardrails Event");
    long quizId = createQuiz(organiser, eventId, "Guardrails Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Only question", 1, 30);
    long questionId = question.path("id").asLong();
    long optionId = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();

    JsonNode badJoin =
        postJson(
            "/api/sessions/join", null, Map.of("joinCode", "NOPE25", "displayName", "Ada"), 404);
    assertThat(badJoin.path("error").path("message").asText())
        .isEqualTo("Invalid or expired join code");

    JsonNode participant =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Ada"),
                200)
            .path("data");
    String rejoinToken = participant.path("rejoinToken").asText();

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    JsonNode editWhileActive =
        putJson(
            "/api/quizzes/" + quizId,
            organiser,
            Map.of("title", "Changed late", "orderIndex", 1, "displayMode", "LIVE"),
            409);
    assertThat(editWhileActive.path("error").path("message").asText())
        .isEqualTo("Quiz has an active session and cannot be edited.");

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    JsonNode wrongQuestion =
        postJson(
            "/api/sessions/" + sessionId + "/answers",
            null,
            Map.of(
                "rejoinToken",
                rejoinToken,
                "questionId",
                questionId + 999,
                "selectedOptionIds",
                List.of(optionId)),
            409);
    assertThat(wrongQuestion.path("error").path("message").asText())
        .isEqualTo("Question is no longer active");

    JsonNode invalidOption =
        postJson(
            "/api/sessions/" + sessionId + "/answers",
            null,
            Map.of(
                "rejoinToken",
                rejoinToken,
                "questionId",
                questionId,
                "selectedOptionIds",
                List.of(optionId + 999)),
            400);
    assertThat(invalidOption.path("error").path("message").asText())
        .isEqualTo("Selection contains an option that does not belong to the question");

    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);
    JsonNode lateJoin =
        postJson(
            "/api/sessions/join",
            null,
            Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Late"),
            404);
    assertThat(lateJoin.path("error").path("message").asText())
        .isEqualTo("Invalid or expired join code");
  }

  @Test
  void answerCanChangeUntilLockInAndThenBecomesFrozen() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Answer Mutability Event");
    long quizId = createQuiz(organiser, eventId, "Answer Mutability Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Mutable answer", 1, 30);
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

    JsonNode timed =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    JsonNode stats = timed.path("questionStatsById").path(String.valueOf(questionId));
    assertThat(stats.path("counts").path(String.valueOf(correctOptionId)).asLong()).isEqualTo(1);
    assertThat(stats.path("counts").path(String.valueOf(wrongOptionId)).asLong()).isZero();
    assertThat(stats.path("totalAnswered").asLong()).isEqualTo(1);

    postJson(
        "/api/sessions/" + sessionId + "/lock-in",
        null,
        Map.of("rejoinToken", rejoinToken, "questionId", questionId),
        200);

    JsonNode editAfterLock =
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
            409);
    assertThat(editAfterLock.path("error").path("message").asText())
        .isEqualTo("Answer is already frozen");

    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(scoreFor(results.path("leaderboard"), "Ada")).isEqualTo(10);
    assertThat(results.path("questions").get(0).path("options").get(0).path("count").asLong())
        .isEqualTo(1);
    assertThat(results.path("questions").get(0).path("options").get(1).path("count").asLong())
        .isZero();
  }

  private long scoreFor(JsonNode leaderboard, String displayName) {
    for (JsonNode entry : leaderboard) {
      if (entry.path("displayName").asText().equals(displayName)) {
        return entry.path("score").asLong();
      }
    }
    throw new AssertionError("Missing leaderboard entry for " + displayName);
  }
}
