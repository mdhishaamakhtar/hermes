package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.web.socket.messaging.WebSocketStompClient;

/**
 * Integration tests for destructive deletes across the ownership tree.
 *
 * <p>Deleting an event has to unwind everything hanging off it — quizzes, their sessions, and the
 * participants and answers recorded against those sessions. Those last two tables have no read
 * endpoint, so orphans would be invisible to every other suite; these tests assert on row counts
 * directly.
 */
class EventDeletionCascadeIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that deleting an event with a played-through session removes the participants and
   * answers belonging to it, and leaves an unrelated organiser's data untouched.
   */
  @Test
  void deletingAnEventRemovesItsSessionsParticipantsAndAnswers() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Doomed Event");
    long quizId = createQuiz(owner, eventId, "Doomed Quiz");
    JsonNode question = createSingleSelectQuestion(owner, quizId, "Doomed question", 1, 30);
    long questionId = question.path("id").asLong();
    long optionId = question.path("options").get(0).path("id").asLong();

    // A second organiser's event must survive the delete untouched.
    Auth bystander = organiser();
    long bystanderEventId = createEvent(bystander, "Innocent Event");
    long bystanderQuizId = createQuiz(bystander, bystanderEventId, "Innocent Quiz");
    createSingleSelectQuestion(bystander, bystanderQuizId, "Innocent question", 1, 30);
    JsonNode bystanderSession =
        postJson("/api/sessions", bystander, Map.of("quizId", bystanderQuizId), 201).path("data");
    postJson(
        "/api/sessions/join",
        null,
        Map.of("joinCode", bystanderSession.path("joinCode").asText(), "displayName", "Untouched"),
        200);

    JsonNode session = postJson("/api/sessions", owner, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();

    String rejoinToken =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Sam"),
                200)
            .path("data")
            .path("rejoinToken")
            .asText();

    WebSocketStompClient client = stompClient();
    StompSession participantSession = connect(client, null);
    BlockingQueue<JsonNode> answerAcks = new LinkedBlockingQueue<>();
    BlockingQueue<JsonNode> questionEvents = new LinkedBlockingQueue<>();
    subscribe(participantSession, "/user/queue/answers", answerAcks);
    subscribe(participantSession, "/topic/session." + sessionId + ".question", questionEvents);

    postJson("/api/sessions/" + sessionId + "/start", owner, Map.of(), 200);
    waitForEvent(questionEvents, "QUESTION_DISPLAYED");
    postJson("/api/sessions/" + sessionId + "/start-timer", owner, Map.of(), 200);
    waitForEvent(questionEvents, "TIMER_START");

    StompHeaders headers = new StompHeaders();
    headers.setDestination("/app/session/" + sessionId + "/answer");
    participantSession.send(
        headers,
        Map.of(
            "rejoinToken",
            rejoinToken,
            "questionId",
            questionId,
            "selectedOptionIds",
            List.of(optionId),
            "clientRequestId",
            "cascade-1"));
    waitForEvent(answerAcks, "ANSWER_ACCEPTED");
    participantSession.disconnect();

    assertThat(rowCount("participant_answers")).isEqualTo(1);
    assertThat(rowCount("participants")).isEqualTo(2);
    assertThat(rowCount("quiz_sessions")).isEqualTo(2);

    deleteJson("/api/events/" + eventId, owner, 200);

    assertThat(rowCount("participant_answers"))
        .as("answers from the deleted event's session must not be orphaned")
        .isZero();
    assertThat(rowCount("participants"))
        .as("only the bystander's participant should remain")
        .isEqualTo(1);
    assertThat(rowCount("quiz_sessions"))
        .as("only the bystander's session should remain")
        .isEqualTo(1);

    getJson("/api/events/" + eventId, owner, 404);
    getJson("/api/quizzes/" + quizId, owner, 404);

    assertThat(
            getJson("/api/events/" + bystanderEventId, bystander, 200)
                .path("data")
                .path("title")
                .asText())
        .isEqualTo("Innocent Event");
  }

  /**
   * Verifies the same unwind one level down: deleting a played quiz directly takes its sessions and
   * participants with it and leaves the parent event intact.
   */
  @Test
  void deletingAPlayedQuizRemovesItsSessionsAndParticipantsButKeepsTheEvent() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Surviving Event");
    long quizId = createQuiz(owner, eventId, "Doomed Quiz");
    createSingleSelectQuestion(owner, quizId, "Question", 1, 30);

    JsonNode session = postJson("/api/sessions", owner, Map.of("quizId", quizId), 201).path("data");
    postJson(
        "/api/sessions/join",
        null,
        Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Kai"),
        200);
    assertThat(rowCount("participants")).isEqualTo(1);

    deleteJson("/api/quizzes/" + quizId, owner, 200);

    assertThat(rowCount("participants")).isZero();
    assertThat(rowCount("quiz_sessions")).isZero();
    assertThat(rowCount("quizzes")).isZero();
    assertThat(getJson("/api/events/" + eventId, owner, 200).path("data").path("quizzes"))
        .isEmpty();
  }

  /**
   * Verifies the no-sessions path: an event whose quizzes were never played still deletes cleanly,
   * taking its quizzes and questions with it.
   */
  @Test
  void deletingAnEventWithoutSessionsStillRemovesItsQuizzesAndQuestions() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Unplayed Event");
    long quizId = createQuiz(owner, eventId, "Unplayed Quiz");
    createSingleSelectQuestion(owner, quizId, "Never asked", 1, 20);

    assertThat(rowCount("questions")).isEqualTo(1);

    deleteJson("/api/events/" + eventId, owner, 200);

    assertThat(rowCount("quiz_sessions")).isZero();
    assertThat(rowCount("quizzes")).isZero();
    assertThat(rowCount("questions")).isZero();
    assertThat(getJson("/api/events", owner, 200).path("data")).isEmpty();
  }
}
