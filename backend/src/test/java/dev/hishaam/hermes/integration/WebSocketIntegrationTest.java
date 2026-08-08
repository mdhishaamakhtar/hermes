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
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.messaging.WebSocketStompClient;

/**
 * Integration tests for the STOMP/WebSocket event stream.
 *
 * <p>This suite validates the live publish/subscribe layer for session control events, question
 * updates, answer acknowledgements, and authorization boundaries on topic subscriptions.
 */
class WebSocketIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that the STOMP flow emits the expected session events and per-user answer
   * acknowledgements as the organiser starts, runs, and scores a live question.
   */
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

    // NOTE: calling disconnect() here races with StompBrokerRelayMessageHandler's
    // per-client circuit teardown — the relay pre-emptively closes the virtual STOMP session
    // to RabbitMQ before our DISCONNECT frame can be forwarded, producing "Failed to forward
    // DISCONNECT" ERROR logs from Spring during teardown. Test assertions are unaffected;
    // RabbitMQ reaps the abandoned session via the STOMP plugin's connection TTL. Silencing
    // the logger would mask real broker-connection regressions, so the noise is accepted.
    participantSession.disconnect();
    organiserSession.disconnect();
  }

  /**
   * Verifies that a refused answer or lock-in comes back to the submitting participant as an
   * ANSWER_REJECTED frame carrying the originating error code and message, rather than failing
   * silently. Covers all three rejection reasons the handler can surface: the question not being
   * open for answers, a lock-in with nothing submitted, and a stale question id.
   */
  @Test
  void answerAndLockInFailuresReachTheSubmittingParticipantAsRejectionFrames() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Rejection Event");
    long quizId = createQuiz(organiser, eventId, "Rejection Quiz");
    JsonNode first = createSingleSelectQuestion(organiser, quizId, "First question", 1, 30);
    JsonNode second = createSingleSelectQuestion(organiser, quizId, "Second question", 2, 30);
    long firstQuestionId = first.path("id").asLong();
    long secondQuestionId = second.path("id").asLong();
    long firstOptionId = first.path("options").get(0).path("id").asLong();
    long secondOptionId = second.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();

    WebSocketStompClient participantClient = stompClient();
    StompSession participantSession = connect(participantClient, null);
    BlockingQueue<JsonNode> answerAcks = new LinkedBlockingQueue<>();
    BlockingQueue<JsonNode> questionEvents = new LinkedBlockingQueue<>();
    subscribe(participantSession, "/user/queue/answers", answerAcks);
    subscribe(participantSession, "/topic/session." + sessionId + ".question", questionEvents);

    String rejoinToken =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Rey"),
                200)
            .path("data")
            .path("rejoinToken")
            .asText();

    // The question is DISPLAYED but the host has not started the timer, so it takes no answers yet.
    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    waitForEvent(questionEvents, "QUESTION_DISPLAYED");

    sendAnswer(participantSession, sessionId, rejoinToken, firstQuestionId, firstOptionId, "rej-1");
    JsonNode tooEarly = waitForEvent(answerAcks, "ANSWER_REJECTED");
    assertThat(tooEarly.path("clientRequestId").asText()).isEqualTo("rej-1");
    assertThat(tooEarly.path("questionId").asLong()).isEqualTo(firstQuestionId);
    assertThat(tooEarly.path("code").asText()).isEqualTo("CONFLICT");
    assertThat(tooEarly.path("message").asText())
        .isEqualTo("Question is not currently accepting answers");
    assertThat(tooEarly.path("lockedIn").asBoolean()).isFalse();

    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    waitForEvent(questionEvents, "TIMER_START");

    // Locking in before submitting anything must be refused, and flagged as a lock-in rejection.
    StompHeaders lockHeaders = new StompHeaders();
    lockHeaders.setDestination("/app/session/" + sessionId + "/lock-in");
    participantSession.send(
        lockHeaders,
        Map.of(
            "rejoinToken", rejoinToken, "questionId", firstQuestionId, "clientRequestId", "rej-2"));

    JsonNode lockTooEarly = waitForEvent(answerAcks, "ANSWER_REJECTED");
    assertThat(lockTooEarly.path("clientRequestId").asText()).isEqualTo("rej-2");
    assertThat(lockTooEarly.path("code").asText()).isEqualTo("CONFLICT");
    assertThat(lockTooEarly.path("message").asText())
        .isEqualTo("Cannot lock in before submitting an answer");
    assertThat(lockTooEarly.path("lockedIn").asBoolean()).isTrue();

    // A late client answering the question that is not on screen must be refused too.
    sendAnswer(
        participantSession, sessionId, rejoinToken, secondQuestionId, secondOptionId, "rej-3");
    JsonNode staleQuestion = waitForEvent(answerAcks, "ANSWER_REJECTED");
    assertThat(staleQuestion.path("clientRequestId").asText()).isEqualTo("rej-3");
    assertThat(staleQuestion.path("questionId").asLong()).isEqualTo(secondQuestionId);
    assertThat(staleQuestion.path("message").asText()).isEqualTo("Question is no longer active");

    // The same participant can still answer the live question afterwards.
    sendAnswer(participantSession, sessionId, rejoinToken, firstQuestionId, firstOptionId, "rej-4");
    assertThat(waitForEvent(answerAcks, "ANSWER_ACCEPTED").path("clientRequestId").asText())
        .isEqualTo("rej-4");

    participantSession.disconnect();
  }

  /** Connects with a verbatim Authorization header, bypassing the Bearer-prefixing helper. */
  private StompSession connectWithRawAuthHeader(WebSocketStompClient client, String authHeader)
      throws Exception {
    StompHeaders headers = new StompHeaders();
    headers.add("Authorization", authHeader);
    StompSession session =
        client
            .connectAsync(
                wsUrl(), new WebSocketHttpHeaders(), headers, new StompSessionHandlerAdapter() {})
            .get(10, TimeUnit.SECONDS);
    session.setAutoReceipt(true);
    return session;
  }

  private void sendAnswer(
      StompSession session,
      long sessionId,
      String rejoinToken,
      long questionId,
      long optionId,
      String clientRequestId) {
    StompHeaders headers = new StompHeaders();
    headers.setDestination("/app/session/" + sessionId + "/answer");
    session.send(
        headers,
        Map.of(
            "rejoinToken",
            rejoinToken,
            "questionId",
            questionId,
            "selectedOptionIds",
            List.of(optionId),
            "clientRequestId",
            clientRequestId));
  }

  /**
   * Verifies that a credential the handshake cannot accept degrades the connection to anonymous
   * rather than failing it — a participant with a stale or malformed token still joins the quiz,
   * they just get no organiser privileges. Covers both an unusable scheme and an invalid token.
   */
  @Test
  void unusableCredentialsFallBackToAnAnonymousConnectionInsteadOfFailing() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Degraded Auth Event");
    long quizId = createQuiz(owner, eventId, "Degraded Auth Quiz");
    JsonNode question = createSingleSelectQuestion(owner, quizId, "Question", 1, 30);
    long questionId = question.path("id").asLong();

    JsonNode session = postJson("/api/sessions", owner, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();

    // A token that is well-formed as a header but not a valid JWT.
    WebSocketStompClient client = stompClient();
    StompSession degraded = connect(client, "not-a-real-jwt");
    BlockingQueue<JsonNode> questionEvents = new LinkedBlockingQueue<>();
    subscribe(degraded, "/topic/session." + sessionId + ".question", questionEvents);

    postJson(
        "/api/sessions/join",
        null,
        Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Stale"),
        200);
    postJson("/api/sessions/" + sessionId + "/start", owner, Map.of(), 200);
    assertThat(waitForEvent(questionEvents, "QUESTION_DISPLAYED").path("questionId").asLong())
        .as("an unauthenticated client still receives the participant question stream")
        .isEqualTo(questionId);

    // A credential in a scheme the handshake does not understand is ignored the same way.
    WebSocketStompClient basicAuthClient = stompClient();
    StompSession basicAuth = connectWithRawAuthHeader(basicAuthClient, "Basic dXNlcjpwYXNz");
    BlockingQueue<JsonNode> basicAuthEvents = new LinkedBlockingQueue<>();
    subscribe(basicAuth, "/topic/session." + sessionId + ".question", basicAuthEvents);
    postJson("/api/sessions/" + sessionId + "/start-timer", owner, Map.of(), 200);
    assertThat(waitForEvent(basicAuthEvents, "TIMER_START").path("questionId").asLong())
        .isEqualTo(questionId);
    basicAuth.disconnect();

    // …but it is still anonymous, so organiser topics remain closed to it.
    CountDownLatch rejected = new CountDownLatch(1);
    WebSocketStompClient probeClient = stompClient();
    StompSession probe = connect(probeClient, "not-a-real-jwt", rejected);
    probe.subscribe(
        "/topic/session." + sessionId + ".analytics", handler(new LinkedBlockingQueue<>()));
    assertThat(rejected.await(10, TimeUnit.SECONDS))
        .as("a degraded connection must not gain organiser access")
        .isTrue();

    degraded.disconnect();
  }

  /**
   * Verifies that subscribing to the organiser topic of a session that does not exist is denied.
   */
  @Test
  void organiserTopicsForUnknownSessionsAreRejected() throws Exception {
    Auth owner = organiser();

    WebSocketStompClient client = stompClient();
    CountDownLatch rejected = new CountDownLatch(1);
    StompSession session = connect(client, owner.token(), rejected);
    session.subscribe("/topic/session.999999.analytics", handler(new LinkedBlockingQueue<>()));

    assertThat(rejected.await(10, TimeUnit.SECONDS))
        .as("a valid organiser may not subscribe to a session that does not exist")
        .isTrue();
  }

  /**
   * Verifies that protected organiser topics reject subscriptions from non-owners and anonymous
   * clients.
   */
  @Test
  void organiserTopicsRejectSubscriptionsFromNonOwnersAndAnonymousClients() throws Exception {
    Auth owner = organiser();
    Auth intruder = organiser();
    long eventId = createEvent(owner, "Private Socket Event");
    long quizId = createQuiz(owner, eventId, "Private Socket Quiz");
    createSingleSelectQuestion(owner, quizId, "Question", 1, 30);

    JsonNode session = postJson("/api/sessions", owner, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();

    WebSocketStompClient intruderClient = stompClient();
    CountDownLatch intruderRejected = new CountDownLatch(1);
    StompSession intruderSession = connect(intruderClient, intruder.token(), intruderRejected);
    // The broker relay closes the underlying WebSocket when a subscription is denied, so a
    // follow-up disconnect() would throw "session has been closed". Drain the rejected frame
    // and let the transport close on its own rather than forcing a DISCONNECT.
    intruderSession.subscribe(
        "/topic/session." + sessionId + ".analytics", handler(new LinkedBlockingQueue<>()));
    assertThat(intruderRejected.await(10, TimeUnit.SECONDS))
        .as("authenticated non-owner subscription to the analytics topic must be rejected")
        .isTrue();

    WebSocketStompClient anonymousClient = stompClient();
    CountDownLatch anonymousRejected = new CountDownLatch(1);
    StompSession anonymousSession = connect(anonymousClient, null, anonymousRejected);
    anonymousSession.subscribe(
        "/topic/session." + sessionId + ".control", handler(new LinkedBlockingQueue<>()));
    assertThat(anonymousRejected.await(10, TimeUnit.SECONDS))
        .as("anonymous subscription to the control topic must be rejected")
        .isTrue();
  }
}
