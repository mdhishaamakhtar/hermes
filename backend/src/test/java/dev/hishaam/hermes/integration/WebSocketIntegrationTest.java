package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.scheduling.concurrent.ConcurrentTaskScheduler;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

class WebSocketIntegrationTest extends BaseIntegrationTest {

  @Test
  void stompFlowPublishesSessionEventsAndPerUserAnswerAcknowledgements() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Socket Event");
    long quizId = createQuiz(organiser, eventId, "Socket Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Socket question", 1, 30);
    long questionId = question.path("id").asLong();
    long optionId = question.path("options").get(0).path("id").asLong();

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

    JsonNode join =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Lin"),
                200)
            .path("data");
    String rejoinToken = join.path("rejoinToken").asText();
    assertThat(waitForEvent(controlEvents, "PARTICIPANT_JOINED").path("count").asLong())
        .isEqualTo(1);

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    JsonNode displayed = waitForEvent(questionEvents, "QUESTION_DISPLAYED");
    assertThat(displayed.path("questionId").asLong()).isEqualTo(questionId);
    assertThat(displayed.path("options")).hasSize(2);

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    JsonNode timerStart = waitForEvent(questionEvents, "TIMER_START");
    assertThat(timerStart.path("questionId").asLong()).isEqualTo(questionId);
    assertThat(timerStart.path("timeLimitSeconds").asInt()).isEqualTo(30);

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
            List.of(optionId),
            "clientRequestId",
            "ws-answer-1"));

    JsonNode accepted = waitForEvent(answerAcks, "ANSWER_ACCEPTED");
    assertThat(accepted.path("clientRequestId").asText()).isEqualTo("ws-answer-1");
    assertThat(accepted.path("questionId").asLong()).isEqualTo(questionId);
    assertThat(accepted.path("lockedIn").asBoolean()).isFalse();

    JsonNode answerUpdate = waitForEvent(analyticsEvents, "ANSWER_UPDATE");
    assertThat(answerUpdate.path("questionId").asLong()).isEqualTo(questionId);
    assertThat(answerUpdate.path("totalAnswered").asLong()).isEqualTo(1);
    assertThat(answerUpdate.path("totalParticipants").asLong()).isEqualTo(1);

    StompHeaders lockHeaders = new StompHeaders();
    lockHeaders.setDestination("/app/session/" + sessionId + "/lock-in");
    participantSession.send(
        lockHeaders,
        Map.of(
            "rejoinToken", rejoinToken, "questionId", questionId, "clientRequestId", "ws-lock-1"));

    JsonNode lockAccepted = waitForEvent(answerAcks, "ANSWER_ACCEPTED");
    assertThat(lockAccepted.path("clientRequestId").asText()).isEqualTo("ws-lock-1");
    assertThat(lockAccepted.path("lockedIn").asBoolean()).isTrue();

    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    assertThat(waitForEvent(questionEvents, "QUESTION_FROZEN").path("questionId").asLong())
        .isEqualTo(questionId);
    assertThat(waitForEvent(questionEvents, "QUESTION_REVIEWED").path("questionId").asLong())
        .isEqualTo(questionId);
    JsonNode leaderboard = waitForEvent(questionEvents, "PARTICIPANT_LEADERBOARD");
    assertThat(leaderboard.path("leaderboard").get(0).path("displayName").asText())
        .isEqualTo("Lin");
    assertThat(leaderboard.path("leaderboard").get(0).path("score").asLong()).isEqualTo(10);

    participantSession.disconnect();
    organiserSession.disconnect();
  }

  private WebSocketStompClient stompClient() {
    WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
    client.setMessageConverter(new MappingJackson2MessageConverter());
    client.setTaskScheduler(
        new ConcurrentTaskScheduler(
            Executors.newSingleThreadScheduledExecutor(
                task -> {
                  Thread thread = new Thread(task, "stomp-test-receipts");
                  thread.setDaemon(true);
                  return thread;
                })));
    return client;
  }

  private StompSession connect(WebSocketStompClient client, String token) throws Exception {
    StompHeaders headers = new StompHeaders();
    if (token != null) {
      headers.add("Authorization", "Bearer " + token);
    }
    StompSession session =
        client
            .connectAsync(
                wsUrl(), new WebSocketHttpHeaders(), headers, new StompSessionHandlerAdapter() {})
            .get(10, TimeUnit.SECONDS);
    session.setAutoReceipt(true);
    return session;
  }

  private void subscribe(StompSession session, String destination, BlockingQueue<JsonNode> queue)
      throws Exception {
    CountDownLatch subscribed = new CountDownLatch(1);
    CountDownLatch failed = new CountDownLatch(1);
    StompSession.Subscription subscription = session.subscribe(destination, handler(queue));
    subscription.addReceiptTask(subscribed::countDown);
    subscription.addReceiptLostTask(failed::countDown);
    if (!subscribed.await(10, TimeUnit.SECONDS)) {
      if (failed.getCount() == 0) {
        throw new AssertionError("Lost STOMP receipt for subscription to " + destination);
      }
      throw new AssertionError("Timed out waiting for subscription to " + destination);
    }
  }

  private StompFrameHandler handler(BlockingQueue<JsonNode> queue) {
    return new StompFrameHandler() {
      @Override
      public Type getPayloadType(StompHeaders headers) {
        return JsonNode.class;
      }

      @Override
      public void handleFrame(StompHeaders headers, Object payload) {
        queue.add((JsonNode) payload);
      }
    };
  }

  private JsonNode waitForEvent(BlockingQueue<JsonNode> queue, String event) throws Exception {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
    JsonNode last = null;
    while (System.nanoTime() < deadline) {
      JsonNode next = queue.poll(250, TimeUnit.MILLISECONDS);
      if (next == null) {
        continue;
      }
      last = next;
      if (event.equals(next.path("event").asText())) {
        return next;
      }
    }
    throw new AssertionError("Timed out waiting for " + event + ", last event was " + last);
  }
}
