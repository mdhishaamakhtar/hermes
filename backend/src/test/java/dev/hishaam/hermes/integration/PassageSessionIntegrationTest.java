package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PassageSessionIntegrationTest extends BaseIntegrationTest {

  @Test
  void entirePassageSessionAcceptsSubQuestionAnswersRejoinsReviewsAndProducesResults()
      throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Passage Event");
    long quizId = createQuiz(organiser, eventId, "Passage Quiz");

    JsonNode passage =
        postJson(
                "/api/quizzes/" + quizId + "/passages",
                organiser,
                Map.of(
                    "text",
                    "Read the architecture notes before answering.",
                    "orderIndex",
                    1,
                    "timerMode",
                    "ENTIRE_PASSAGE",
                    "timeLimitSeconds",
                    45,
                    "subQuestions",
                    new Object[] {
                      Map.of(
                          "text",
                          "Which runtime is used?",
                          "orderIndex",
                          0,
                          "questionType",
                          "SINGLE_SELECT",
                          "displayModeOverride",
                          "CODE_DISPLAY",
                          "options",
                          options("Java 25", 0, 7, "Java 8", 1, 0)),
                      Map.of(
                          "text",
                          "Which backing services are live?",
                          "orderIndex",
                          1,
                          "questionType",
                          "MULTI_SELECT",
                          "options",
                          options("Redis", 0, 5, "RabbitMQ", 1, 5, "Static JSON", 2, -3))
                    }),
                201)
            .path("data");
    JsonNode passageQuestion = passage.path("subQuestions").get(0);
    JsonNode passageMulti = passage.path("subQuestions").get(1);
    long passageQuestionId = passageQuestion.path("id").asLong();
    long passageQuestionCorrect = passageQuestion.path("options").get(0).path("id").asLong();
    long passageQuestionWrong = passageQuestion.path("options").get(1).path("id").asLong();
    long passageMultiId = passageMulti.path("id").asLong();
    long passageMultiRedis = passageMulti.path("options").get(0).path("id").asLong();
    long passageMultiRabbit = passageMulti.path("options").get(1).path("id").asLong();

    JsonNode standalone = createSingleSelectQuestion(organiser, quizId, "Final standalone", 2, 20);
    long standaloneId = standalone.path("id").asLong();
    long standaloneCorrect = standalone.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    JsonNode ada =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Ada"),
                200)
            .path("data");
    JsonNode grace =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Grace"),
                200)
            .path("data");
    String adaToken = ada.path("rejoinToken").asText();
    String graceToken = grace.path("rejoinToken").asText();

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    JsonNode displayed =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(displayed.path("questionLifecycle").asText()).isEqualTo("DISPLAYED");
    assertThat(displayed.path("currentQuestion").isNull()).isTrue();
    assertThat(displayed.path("currentPassage").path("id").asLong())
        .isEqualTo(passage.path("id").asLong());
    assertThat(displayed.path("currentPassage").path("timerMode").asText())
        .isEqualTo("ENTIRE_PASSAGE");
    assertThat(displayed.path("currentPassage").path("subQuestions")).hasSize(2);
    assertThat(displayed.path("questionStatsById").has(String.valueOf(passageQuestionId))).isTrue();
    assertThat(displayed.path("questionStatsById").has(String.valueOf(passageMultiId))).isTrue();

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken",
            adaToken,
            "questionId",
            passageQuestionId,
            "selectedOptionIds",
            List.of(passageQuestionCorrect)),
        200);
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken",
            adaToken,
            "questionId",
            passageMultiId,
            "selectedOptionIds",
            List.of(passageMultiRedis, passageMultiRabbit)),
        200);
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken",
            graceToken,
            "questionId",
            passageQuestionId,
            "selectedOptionIds",
            List.of(passageQuestionWrong)),
        200);

    JsonNode rejoin =
        postJson(
                "/api/sessions/rejoin",
                null,
                Map.of("rejoinToken", adaToken, "sessionId", sessionId),
                200)
            .path("data");
    assertThat(rejoin.path("currentPassage").path("subQuestions")).hasSize(2);
    JsonNode rejoinedFirstSelection =
        rejoin.path("currentPassage").path("subQuestions").get(0).path("selectedOptionIds");
    assertThat(rejoinedFirstSelection).hasSize(1);
    assertThat(rejoinedFirstSelection.get(0).asLong()).isEqualTo(passageQuestionCorrect);
    JsonNode rejoinedSecondSelection =
        rejoin.path("currentPassage").path("subQuestions").get(1).path("selectedOptionIds");
    assertThat(rejoinedSecondSelection).hasSize(2);
    assertThat(rejoinedSecondSelection.get(0).asLong()).isEqualTo(passageMultiRedis);
    assertThat(rejoinedSecondSelection.get(1).asLong()).isEqualTo(passageMultiRabbit);

    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    JsonNode reviewing =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(reviewing.path("questionLifecycle").asText()).isEqualTo("REVIEWING");
    JsonNode passageQuestionStats =
        reviewing.path("questionStatsById").path(String.valueOf(passageQuestionId));
    assertThat(passageQuestionStats.path("totalAnswered").asLong()).isEqualTo(2);
    assertThat(passageQuestionStats.path("totalParticipants").asLong()).isEqualTo(2);
    assertThat(passageQuestionStats.path("revealed").asBoolean()).isTrue();
    assertThat(passageQuestionStats.path("reviewed").asBoolean()).isTrue();
    assertThat(reviewing.path("leaderboard")).hasSize(2);
    assertThat(scoreFor(reviewing.path("leaderboard"), "Ada")).isEqualTo(17);
    assertThat(scoreFor(reviewing.path("leaderboard"), "Grace")).isZero();

    postJson("/api/sessions/" + sessionId + "/next", organiser, Map.of(), 200);
    JsonNode next =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(next.path("currentQuestion").path("id").asLong()).isEqualTo(standaloneId);
    assertThat(next.path("currentPassage").isNull()).isTrue();

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken",
            adaToken,
            "questionId",
            standaloneId,
            "selectedOptionIds",
            List.of(standaloneCorrect)),
        200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(results.path("questions")).hasSize(3);
    assertThat(results.path("questions").get(0).path("passageId").asLong())
        .isEqualTo(passage.path("id").asLong());
    assertThat(results.path("questions").get(0).path("passageText").asText())
        .isEqualTo("Read the architecture notes before answering.");
    assertThat(results.path("questions").get(0).path("totalAnswers").asLong()).isEqualTo(2);
    assertThat(results.path("questions").get(1).path("totalAnswers").asLong()).isEqualTo(1);
    assertThat(results.path("questions").get(2).path("totalAnswers").asLong()).isEqualTo(1);
    assertThat(scoreFor(results.path("leaderboard"), "Ada")).isEqualTo(27);
    assertThat(scoreFor(results.path("leaderboard"), "Grace")).isZero();
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
