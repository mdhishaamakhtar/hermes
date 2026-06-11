package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AnswerGuardsIntegrationTest extends BaseIntegrationTest {

  @Test
  void lockInRequiresASubmittedNonEmptySelectionAndCannotBeRepeated() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Lock-In Event");
    long quizId = createQuiz(organiser, eventId, "Lock-In Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Lock-in rules", 1, 30);
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

    JsonNode lockWithoutAnswer =
        postJson(
            "/api/sessions/" + sessionId + "/lock-in",
            null,
            Map.of("rejoinToken", rejoinToken, "questionId", questionId),
            409);
    assertThat(lockWithoutAnswer.path("error").path("message").asText())
        .isEqualTo("Cannot lock in before submitting an answer");

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
    // Submitting an empty selection clears the previous answer
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken", rejoinToken, "questionId", questionId, "selectedOptionIds", List.of()),
        200);

    JsonNode cleared =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    JsonNode clearedStats = cleared.path("questionStatsById").path(String.valueOf(questionId));
    assertThat(clearedStats.path("totalAnswered").asLong()).isZero();
    assertThat(clearedStats.path("counts").path(String.valueOf(correctOptionId)).asLong()).isZero();

    JsonNode lockWithEmptySelection =
        postJson(
            "/api/sessions/" + sessionId + "/lock-in",
            null,
            Map.of("rejoinToken", rejoinToken, "questionId", questionId),
            409);
    assertThat(lockWithEmptySelection.path("error").path("message").asText())
        .isEqualTo("Cannot lock in without a selection");

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
    postJson(
        "/api/sessions/" + sessionId + "/lock-in",
        null,
        Map.of("rejoinToken", rejoinToken, "questionId", questionId),
        200);

    JsonNode doubleLockIn =
        postJson(
            "/api/sessions/" + sessionId + "/lock-in",
            null,
            Map.of("rejoinToken", rejoinToken, "questionId", questionId),
            409);
    assertThat(doubleLockIn.path("error").path("message").asText())
        .isEqualTo("Answer is already frozen");
  }

  @Test
  void singleSelectAnswersRejectMultipleSelectedOptions() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Single Select Event");
    long quizId = createQuiz(organiser, eventId, "Single Select Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Pick exactly one", 1, 30);
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

    JsonNode tooManyOptions =
        postJson(
            "/api/sessions/" + sessionId + "/answers",
            null,
            Map.of(
                "rejoinToken",
                rejoinToken,
                "questionId",
                questionId,
                "selectedOptionIds",
                List.of(correctOptionId, wrongOptionId)),
            400);
    assertThat(tooManyOptions.path("error").path("message").asText())
        .isEqualTo("SINGLE_SELECT questions require exactly one selected option");

    // The rejected submission must not have been counted
    JsonNode sync =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(
            sync.path("questionStatsById")
                .path(String.valueOf(questionId))
                .path("totalAnswered")
                .asLong())
        .isZero();
  }
}
