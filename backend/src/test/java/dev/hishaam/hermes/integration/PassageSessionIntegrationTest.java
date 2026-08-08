package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Integration tests for full session flows that include passages.
 *
 * <p>This suite covers the live-host lifecycle, participant joins and rejoins, passage-based answer
 * collection, review transition, and final result generation when the quiz contains an
 * ENTIRE_PASSAGE block.
 */
class PassageSessionIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies the full passage-driven session flow from join through results, including rejoin
   * state, answer persistence, review stats, and final leaderboard output.
   */
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

    // Ada commits her first answer so the rejoin below can show it as locked.
    postJson(
        "/api/sessions/" + sessionId + "/lock-in",
        null,
        Map.of("rejoinToken", adaToken, "questionId", passageQuestionId),
        200);

    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    JsonNode reviewing =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(reviewing.path("questionLifecycle").asText()).isEqualTo("REVIEWING");

    // Rejoining during review shows the committed selection and unhides a CODE_DISPLAY question's
    // counts, which stay hidden from participants while the question is live.
    JsonNode reviewRejoin =
        postJson(
                "/api/sessions/rejoin",
                null,
                Map.of("rejoinToken", adaToken, "sessionId", sessionId),
                200)
            .path("data");
    JsonNode lockedSub = reviewRejoin.path("currentPassage").path("subQuestions").get(0);
    assertThat(lockedSub.path("lockedIn").asBoolean())
        .as("a locked-in answer is reported as committed on rejoin")
        .isTrue();
    assertThat(lockedSub.path("selectedOptionIds")).hasSize(1);
    JsonNode codeDisplayStats =
        reviewRejoin.path("questionStatsById").path(String.valueOf(passageQuestionId));
    assertThat(codeDisplayStats.path("reviewed").asBoolean()).isTrue();
    assertThat(codeDisplayStats.path("revealed").asBoolean())
        .as("CODE_DISPLAY counts become visible to participants once under review")
        .isTrue();
    JsonNode multiStats =
        reviewRejoin.path("questionStatsById").path(String.valueOf(passageMultiId));
    assertThat(multiStats.path("revealed").asBoolean())
        .as("the BLIND sibling is revealed under review too")
        .isTrue();
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

  /**
   * Verifies the other passage timer mode end to end. PER_SUB_QUESTION advances each sub-question
   * individually like a standalone question while still carrying its passage context, so it drives
   * a different display, rejoin, and results path than the ENTIRE_PASSAGE block above. Also covers
   * a participant who never answers, and the reveal rules for a non-live display mode.
   */
  @Test
  void perSubQuestionPassageAdvancesIndividuallyAndKeepsPassageContextThroughout()
      throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Per Sub Event");
    long quizId = createQuiz(organiser, eventId, "Per Sub Quiz");

    JsonNode passage =
        postJson(
                "/api/quizzes/" + quizId + "/passages",
                organiser,
                Map.of(
                    "text",
                    "Study the deployment topology.",
                    "orderIndex",
                    1,
                    "timerMode",
                    "PER_SUB_QUESTION",
                    "subQuestions",
                    new Object[] {
                      Map.of(
                          "text",
                          "Which store is ephemeral?",
                          "orderIndex",
                          0,
                          "timeLimitSeconds",
                          25,
                          "questionType",
                          "SINGLE_SELECT",
                          "options",
                          options("Redis", 0, 8, "Postgres", 1, 0)),
                      Map.of(
                          "text",
                          "Which store is durable?",
                          "orderIndex",
                          1,
                          "timeLimitSeconds",
                          25,
                          "questionType",
                          "SINGLE_SELECT",
                          "displayModeOverride",
                          "LIVE",
                          "options",
                          options("Postgres", 0, 8, "Redis", 1, 0))
                    }),
                201)
            .path("data");
    long passageId = passage.path("id").asLong();
    JsonNode blindSub = passage.path("subQuestions").get(0);
    JsonNode liveSub = passage.path("subQuestions").get(1);
    long blindSubId = blindSub.path("id").asLong();
    long liveSubId = liveSub.path("id").asLong();
    long blindCorrect = blindSub.path("options").get(0).path("id").asLong();

    // The quiz-level BLIND mode applies to the sub-question that does not override it.
    assertThat(blindSub.path("effectiveDisplayMode").asText()).isEqualTo("BLIND");
    assertThat(liveSub.path("effectiveDisplayMode").asText()).isEqualTo("LIVE");

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String joinCode = session.path("joinCode").asText();
    String answererToken = join(joinCode, "Answerer");
    String silentToken = join(joinCode, "Silent");

    // Unlike ENTIRE_PASSAGE, the first sub-question is displayed on its own, not as a block.
    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    JsonNode displayed =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(displayed.path("currentPassage").isNull())
        .as("PER_SUB_QUESTION shows one question at a time, never a passage block")
        .isTrue();
    assertThat(displayed.path("currentQuestion").path("id").asLong()).isEqualTo(blindSubId);
    assertThat(displayed.path("currentQuestion").path("passage").path("id").asLong())
        .as("the sub-question still carries its passage for the participant to read")
        .isEqualTo(passageId);
    assertThat(displayed.path("currentQuestion").path("passage").path("text").asText())
        .isEqualTo("Study the deployment topology.");

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);

    // A participant rejoining mid-question sees the sub-question with its passage attached.
    JsonNode midRejoin = rejoin(answererToken, sessionId);
    assertThat(midRejoin.path("currentPassage").isNull()).isTrue();
    assertThat(midRejoin.path("currentQuestion").path("passage").path("id").asLong())
        .isEqualTo(passageId);
    assertThat(midRejoin.path("currentQuestion").path("selectedOptionIds")).isEmpty();
    assertThat(midRejoin.path("currentQuestion").path("lockedIn").asBoolean()).isFalse();

    submitAnswer(sessionId, answererToken, blindSubId, blindCorrect);
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);

    // Reviewing a BLIND question reveals the counts that were hidden while it was live.
    JsonNode reviewRejoin = rejoin(answererToken, sessionId);
    JsonNode blindStats = reviewRejoin.path("questionStatsById").path(String.valueOf(blindSubId));
    assertThat(reviewRejoin.path("questionLifecycle").asText()).isEqualTo("REVIEWING");
    assertThat(blindStats.path("reviewed").asBoolean()).isTrue();
    assertThat(blindStats.path("revealed").asBoolean())
        .as("a BLIND question's counts become visible once it is under review")
        .isTrue();

    // The participant who never answered sees an empty selection rather than a missing entry.
    JsonNode silentRejoin = rejoin(silentToken, sessionId);
    assertThat(silentRejoin.path("currentQuestion").path("selectedOptionIds")).isEmpty();
    assertThat(silentRejoin.path("alreadyAnswered")).isEmpty();

    postJson("/api/sessions/" + sessionId + "/next", organiser, Map.of(), 200);
    JsonNode second =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(second.path("currentQuestion").path("id").asLong()).isEqualTo(liveSubId);
    assertThat(second.path("currentQuestion").path("passage").path("id").asLong())
        .isEqualTo(passageId);

    // Ending while the second sub-question is still live leaves it unanswered by everyone.
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(results.path("questions")).hasSize(2);
    assertThat(results.path("questions").get(0).path("passageId").asLong()).isEqualTo(passageId);
    assertThat(results.path("questions").get(0).path("passageText").asText())
        .isEqualTo("Study the deployment topology.");
    assertThat(results.path("questions").get(0).path("totalAnswers").asLong()).isEqualTo(1);
    assertThat(results.path("questions").get(1).path("totalAnswers").asLong())
        .as("nobody answered the question that was live when the host ended the session")
        .isZero();
    assertThat(scoreFor(results.path("leaderboard"), "Answerer")).isEqualTo(8);
    assertThat(scoreFor(results.path("leaderboard"), "Silent")).isZero();

    // A participant who answered nothing still gets a complete, zeroed breakdown.
    JsonNode silentResults =
        getJson(
                "/api/sessions/" + sessionId + "/my-results",
                null,
                Map.of("X-Rejoin-Token", silentToken),
                200)
            .path("data");
    assertThat(silentResults.path("score").asLong()).isZero();
    assertThat(silentResults.path("correctCount").asInt()).isZero();
    assertThat(silentResults.path("questions")).hasSize(2);
    assertThat(silentResults.path("questions").get(0).path("pointsEarned").asLong()).isZero();
    assertThat(silentResults.path("questions").get(0).path("selectedOptionIds")).isEmpty();
    assertThat(silentResults.path("questions").get(0).path("passageId").asLong())
        .isEqualTo(passageId);
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

  private JsonNode rejoin(String rejoinToken, long sessionId) throws Exception {
    return postJson(
            "/api/sessions/rejoin",
            null,
            Map.of("rejoinToken", rejoinToken, "sessionId", sessionId),
            200)
        .path("data");
  }

  private void submitAnswer(long sessionId, String token, long questionId, long optionId)
      throws Exception {
    postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken", token,
            "questionId", questionId,
            "selectedOptionIds", List.of(optionId)),
        200);
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
