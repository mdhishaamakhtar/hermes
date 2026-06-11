package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class TimerExpiryIntegrationTest extends BaseIntegrationTest {

  @Test
  void expiredQuestionTimerFreezesAnswersGradesAndMovesToReviewing() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Timer Expiry Event");
    long quizId = createQuiz(organiser, eventId, "Timer Expiry Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Quick question", 1, 2);
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

    // The host never calls /end-timer — the Quartz timeout job must do the transition
    JsonNode reviewing = awaitQuestionLifecycle(sessionId, organiser, "REVIEWING");
    JsonNode stats = reviewing.path("questionStatsById").path(String.valueOf(questionId));
    assertThat(stats.path("totalAnswered").asLong()).isEqualTo(1);
    assertThat(stats.path("reviewed").asBoolean()).isTrue();
    assertThat(reviewing.path("leaderboard").get(0).path("displayName").asText()).isEqualTo("Ada");
    assertThat(reviewing.path("leaderboard").get(0).path("score").asLong()).isEqualTo(10);

    JsonNode lateAnswer =
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
            409);
    assertThat(lateAnswer.path("error").path("message").asText())
        .isEqualTo("Question is not currently accepting answers");
  }

  @Test
  void timerEndedEarlyDoesNotFireIntoTheNextTimedQuestion() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Stale Timer Event");
    long quizId = createQuiz(organiser, eventId, "Stale Timer Quiz");
    createSingleSelectQuestion(organiser, quizId, "Short fuse", 1, 2);
    JsonNode q2 = createSingleSelectQuestion(organiser, quizId, "Long fuse", 2, 30);
    long q2Id = q2.path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    // End question one early and move on before its 2s Quartz trigger would have fired
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/next", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);

    // Wait past question one's original expiry; a stale firing would freeze question two
    Thread.sleep(3500);

    JsonNode sync =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(sync.path("status").asText()).isEqualTo("ACTIVE");
    assertThat(sync.path("questionLifecycle").asText()).isEqualTo("TIMED");
    assertThat(sync.path("currentQuestion").path("id").asLong()).isEqualTo(q2Id);
  }

  private JsonNode awaitQuestionLifecycle(long sessionId, Auth organiser, String expected)
      throws Exception {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(20);
    JsonNode sync = null;
    while (System.nanoTime() < deadline) {
      sync = getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
      if (expected.equals(sync.path("questionLifecycle").asText())) {
        return sync;
      }
      Thread.sleep(250);
    }
    throw new AssertionError(
        "Timed out waiting for question lifecycle " + expected + ", last sync was " + sync);
  }
}
