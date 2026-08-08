package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Integration tests for answer submission guardrails.
 *
 * <p>This suite covers the participant-facing answer path: lock-in prerequisites, empty answer
 * clearing, single-select validation, and the prevention of duplicate freezes.
 */
class AnswerGuardsIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that locking in requires a submitted non-empty answer and cannot be repeated once an
   * answer has already been frozen.
   */
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

  /**
   * Verifies that single-select questions reject multi-choice submissions and do not count the
   * rejected answer toward live stats.
   */
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

  /**
   * Verifies that changing an answer moves the live tally rather than double-counting: the options
   * dropped from the selection give their count back, and only the newly added ones gain.
   */
  @Test
  void changingASelectionMovesTheTallyInsteadOfAccumulating() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Reselect Event");
    long quizId = createQuiz(organiser, eventId, "Reselect Quiz");
    JsonNode question = createMultiSelectQuestion(organiser, quizId, "Pick some", 1, 30);
    long questionId = question.path("id").asLong();
    long first = question.path("options").get(0).path("id").asLong();
    long second = question.path("options").get(1).path("id").asLong();
    long third = question.path("options").get(2).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session, "Ada");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);

    answer(sessionId, token, questionId, List.of(first, second));
    JsonNode initial = questionStats(sessionId, organiser, questionId);
    assertThat(initial.path("counts").path(String.valueOf(first)).asLong()).isEqualTo(1);
    assertThat(initial.path("counts").path(String.valueOf(second)).asLong()).isEqualTo(1);
    assertThat(initial.path("totalAnswered").asLong()).isEqualTo(1);

    // Keep `first`, drop `second`, add `third`.
    answer(sessionId, token, questionId, List.of(first, third));
    JsonNode revised = questionStats(sessionId, organiser, questionId);
    assertThat(revised.path("counts").path(String.valueOf(first)).asLong())
        .as("an option kept across a change must not be counted twice")
        .isEqualTo(1);
    assertThat(revised.path("counts").path(String.valueOf(second)).asLong())
        .as("a deselected option must give its count back")
        .isZero();
    assertThat(revised.path("counts").path(String.valueOf(third)).asLong()).isEqualTo(1);
    assertThat(revised.path("totalAnswered").asLong()).isEqualTo(1);
  }

  /**
   * Verifies the answer path rejects submissions that do not belong to the live question: a
   * question id absent from the session snapshot, and one from a different quiz entirely.
   */
  @Test
  void answersForQuestionsOutsideTheSessionSnapshotAreRejected() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Foreign Question Event");
    long quizId = createQuiz(organiser, eventId, "Foreign Question Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Live question", 1, 30);
    long questionId = question.path("id").asLong();
    long optionId = question.path("options").get(0).path("id").asLong();

    // A question that exists, but in a quiz this session was never created from.
    long otherQuizId = createQuiz(organiser, eventId, "Other Quiz");
    JsonNode foreign = createSingleSelectQuestion(organiser, otherQuizId, "Foreign", 1, 30);
    long foreignQuestionId = foreign.path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session, "Ada");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);

    assertThat(
            answerExpecting(sessionId, token, foreignQuestionId, List.of(optionId), 409)
                .path("error")
                .path("message")
                .asText())
        .isEqualTo("Question is no longer active");

    assertThat(
            answerExpecting(sessionId, token, 999_999L, List.of(optionId), 409)
                .path("error")
                .path("message")
                .asText())
        .isEqualTo("Question is no longer active");

    // A null inside the selection list is caught by bean validation before the service sees it.
    // (AnswerService keeps its own guard for the STOMP path, which is not bean-validated.)
    JsonNode nullOption =
        postJson(
            "/api/sessions/" + sessionId + "/answers",
            null,
            nullSelectionBody(token, questionId),
            400);
    assertThat(nullOption.path("error").path("message").asText()).isEqualTo("must not be null");
  }

  /** Verifies that a finished session stops accepting answers outright. */
  @Test
  void answersAreRefusedOnceTheSessionHasEnded() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Closed Session Event");
    long quizId = createQuiz(organiser, eventId, "Closed Session Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Question", 1, 30);
    long questionId = question.path("id").asLong();
    long optionId = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session, "Ada");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    assertThat(
            answerExpecting(sessionId, token, questionId, List.of(optionId), 409)
                .path("error")
                .path("message")
                .asText())
        .isEqualTo("Session is not accepting answers");
  }

  /**
   * Verifies that clearing an answer before the timer ends really retracts it: the row survives but
   * stops counting as an answer, scores nothing, and shows an empty selection back to the
   * participant in the final results.
   */
  @Test
  void anAnswerClearedBeforeTheTimerEndsIsRetractedFromResults() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Retraction Event");
    long quizId = createQuiz(organiser, eventId, "Retraction Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Question", 1, 30);
    long questionId = question.path("id").asLong();
    long correct = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session, "Ada");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    answer(sessionId, token, questionId, List.of(correct));
    answer(sessionId, token, questionId, List.of());

    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(results.path("questions").get(0).path("totalAnswers").asLong())
        .as("a retracted answer must not count toward the answered tally")
        .isZero();
    assertThat(results.path("leaderboard").get(0).path("score").asLong()).isZero();

    JsonNode mine =
        getJson(
                "/api/sessions/" + sessionId + "/my-results",
                null,
                Map.of("X-Rejoin-Token", token),
                200)
            .path("data");
    assertThat(mine.path("questions").get(0).path("selectedOptionIds")).isEmpty();
    assertThat(mine.path("questions").get(0).path("pointsEarned").asLong()).isZero();
    assertThat(mine.path("correctCount").asInt()).isZero();
  }

  private String join(JsonNode session, String displayName) throws Exception {
    return postJson(
            "/api/sessions/join",
            null,
            Map.of("joinCode", session.path("joinCode").asText(), "displayName", displayName),
            200)
        .path("data")
        .path("rejoinToken")
        .asText();
  }

  private void answer(long sessionId, String token, long questionId, List<Long> optionIds)
      throws Exception {
    answerExpecting(sessionId, token, questionId, optionIds, 200);
  }

  private JsonNode answerExpecting(
      long sessionId, String token, long questionId, List<Long> optionIds, int status)
      throws Exception {
    return postJson(
        "/api/sessions/" + sessionId + "/answers",
        null,
        Map.of(
            "rejoinToken", token,
            "questionId", questionId,
            "selectedOptionIds", optionIds),
        status);
  }

  /** Built by hand because {@link Map#of} rejects null values. */
  private static Map<String, Object> nullSelectionBody(String token, long questionId) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("rejoinToken", token);
    body.put("questionId", questionId);
    body.put("selectedOptionIds", Collections.singletonList(null));
    return body;
  }

  private JsonNode questionStats(long sessionId, Auth organiser, long questionId) throws Exception {
    return getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200)
        .path("data")
        .path("questionStatsById")
        .path(String.valueOf(questionId));
  }
}
