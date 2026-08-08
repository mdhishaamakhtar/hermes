package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.socket.messaging.WebSocketStompClient;

/**
 * Integration tests for running without an external STOMP broker.
 *
 * <p>{@code app.stomp.broker.mode=simple} swaps the RabbitMQ relay for Spring's in-process broker,
 * which is what a single-instance deployment actually needs. The rest of the suite pins the relay,
 * so this class is what proves the other half of that switch really works end to end.
 *
 * <p>It is deliberately a full session flow rather than a smoke test, because the failure mode is
 * silent: {@code SessionEventPublisher} starts with the broker marked unavailable and only opens up
 * on a {@code BrokerAvailabilityEvent}. If the simple broker did not raise that event, every
 * publish would be dropped and the app would look healthy while participants saw nothing.
 */
@TestPropertySource(properties = "app.stomp.broker.mode=simple")
class SimpleBrokerSessionIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that a whole live session — broadcasts, per-user acknowledgements and organiser-only
   * analytics — works with no broker service running.
   */
  @Test
  void aFullSessionRunsOverTheInProcessBrokerWithNoRelay() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "No Broker Event");
    long quizId = createQuiz(organiser, eventId, "No Broker Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Question", 1, 30);
    long questionId = question.path("id").asLong();
    long correct = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();

    WebSocketStompClient organiserClient = stompClient();
    WebSocketStompClient participantClient = stompClient();
    StompSession organiserSession = connect(organiserClient, organiser.token());
    StompSession participantSession = connect(participantClient, null);

    BlockingQueue<JsonNode> controlEvents = new LinkedBlockingQueue<>();
    BlockingQueue<JsonNode> questionEvents = new LinkedBlockingQueue<>();
    BlockingQueue<JsonNode> analyticsEvents = new LinkedBlockingQueue<>();
    BlockingQueue<JsonNode> answerAcks = new LinkedBlockingQueue<>();

    subscribe(organiserSession, "/topic/session." + sessionId + ".control", controlEvents);
    subscribe(organiserSession, "/topic/session." + sessionId + ".analytics", analyticsEvents);
    subscribe(participantSession, "/topic/session." + sessionId + ".question", questionEvents);
    subscribe(participantSession, "/user/queue/answers", answerAcks);

    String rejoinToken =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Lin"),
                200)
            .path("data")
            .path("rejoinToken")
            .asText();

    // Topic broadcast — the publisher only reaches this point if the in-process broker announced
    // itself as available on startup.
    assertThat(waitForEvent(controlEvents, "PARTICIPANT_JOINED").path("count").asLong())
        .isEqualTo(1);

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    assertThat(waitForEvent(questionEvents, "QUESTION_DISPLAYED").path("questionId").asLong())
        .isEqualTo(questionId);

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    assertThat(waitForEvent(questionEvents, "TIMER_START").path("timeLimitSeconds").asInt())
        .isEqualTo(30);

    StompHeaders answerHeaders = new StompHeaders();
    answerHeaders.setDestination("/app/session/" + sessionId + "/answer");
    participantSession.send(
        answerHeaders,
        Map.of(
            "rejoinToken",
            rejoinToken,
            "questionId",
            questionId,
            "selectedOptionIds",
            List.of(correct),
            "clientRequestId",
            "simple-1"));

    // Per-user queue — /user/** routing is handled in-process here rather than by the broker.
    assertThat(waitForEvent(answerAcks, "ANSWER_ACCEPTED").path("clientRequestId").asText())
        .isEqualTo("simple-1");
    assertThat(waitForEvent(analyticsEvents, "ANSWER_UPDATE").path("totalAnswered").asLong())
        .isEqualTo(1);

    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    assertThat(waitForEvent(questionEvents, "QUESTION_FROZEN").path("questionId").asLong())
        .isEqualTo(questionId);
    assertThat(
            waitForEvent(questionEvents, "PARTICIPANT_LEADERBOARD")
                .path("leaderboard")
                .get(0)
                .path("score")
                .asLong())
        .isEqualTo(10);

    participantSession.disconnect();
    organiserSession.disconnect();
  }

  /**
   * Verifies that organiser-only topics stay protected without a relay — subscription authorisation
   * runs in the channel interceptor, so it must not silently become permissive.
   */
  @Test
  void organiserTopicsRemainProtectedWithoutARelay() throws Exception {
    Auth owner = organiser();
    Auth intruder = organiser();
    long eventId = createEvent(owner, "No Broker Private Event");
    long quizId = createQuiz(owner, eventId, "No Broker Private Quiz");
    createSingleSelectQuestion(owner, quizId, "Question", 1, 30);

    long sessionId =
        postJson("/api/sessions", owner, Map.of("quizId", quizId), 201)
            .path("data")
            .path("id")
            .asLong();

    WebSocketStompClient client = stompClient();
    CountDownLatch rejected = new CountDownLatch(1);
    StompSession session = connect(client, intruder.token(), rejected);
    session.subscribe(
        "/topic/session." + sessionId + ".analytics", handler(new LinkedBlockingQueue<>()));

    assertThat(rejected.await(10, TimeUnit.SECONDS))
        .as("a non-owner must not reach organiser analytics, broker or no broker")
        .isTrue();
  }
}
