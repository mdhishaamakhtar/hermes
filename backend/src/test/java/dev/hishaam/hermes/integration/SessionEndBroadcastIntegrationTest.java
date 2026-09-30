package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.support.BaseIntegrationTest;
import dev.hishaam.hermes.util.SessionRedisKeys;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.stomp.StompSession;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for when SESSION_END reaches clients relative to the end-of-session commit.
 *
 * <p>Clients fetch results the moment SESSION_END arrives, and results are refused until the ENDED
 * status is committed. Left alone, the gap between the two lasts a few milliseconds — too short to
 * observe reliably — so this suite widens it: a second connection holds a row lock on the session,
 * which parks the end-of-session transaction at its commit, after Redis has been cleared and after
 * every point where SESSION_END could have gone out early.
 */
class SessionEndBroadcastIntegrationTest extends BaseIntegrationTest {

  @Autowired private DataSource dataSource;

  @Autowired private JdbcTemplate jdbcTemplate;

  @Autowired private StringRedisTemplate redisTemplate;

  /**
   * Verifies that SESSION_END is withheld until the ENDED status commits, so the results reads the
   * host and players make on receipt succeed first time, and that the final standings it carries
   * are the ones Redis held before the cleanup that precedes the commit.
   */
  @Test
  void sessionEndIsDeliveredOnlyOnceResultsCanBeRead() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Commit Order Event");
    long quizId = createQuiz(organiser, eventId, "Commit Order Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Only question", 1, 30);
    long questionId = question.path("id").asLong();
    long correct = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();

    StompSession host = connect(stompClient(), organiser.token());
    BlockingQueue<JsonNode> questionEvents = new LinkedBlockingQueue<>();
    BlockingQueue<JsonNode> analyticsEvents = new LinkedBlockingQueue<>();
    subscribe(host, "/topic/session." + sessionId + ".question", questionEvents);
    subscribe(host, "/topic/session." + sessionId + ".analytics", analyticsEvents);

    String rejoinToken =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", session.path("joinCode").asText(), "displayName", "Lin"),
                200)
            .path("data")
            .path("rejoinToken")
            .asText();
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
            List.of(correct)),
        200);
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);

    try (ExecutorService hostRequests = Executors.newSingleThreadExecutor()) {
      Future<JsonNode> ending;
      try (Connection sessionRowLock = lockSessionRow(sessionId)) {
        ending =
            hostRequests.submit(
                () -> postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200));
        awaitBlockedBy(sessionRowLock);

        // Parked at commit: Redis has already been cleared, and results are still refused.
        assertThat(redisTemplate.hasKey(SessionRedisKeys.statusKey(sessionId))).isFalse();
        getJson("/api/sessions/" + sessionId + "/results", organiser, 409);

        // Give a premature SESSION_END ample time to cross the broker relay.
        Thread.sleep(1000);
        assertThat(
                Stream.concat(questionEvents.stream(), analyticsEvents.stream())
                    .map(event -> event.path("event").asText()))
            .as("SESSION_END must not be sent before the ENDED status commits")
            .doesNotContain("SESSION_END");

        sessionRowLock.rollback();
      }

      // Read results the instant SESSION_END lands, as the host and players do.
      JsonNode hostEnd = waitForEvent(analyticsEvents, "SESSION_END");
      getJson("/api/sessions/" + sessionId + "/results", organiser, 200);
      waitForEvent(questionEvents, "SESSION_END");
      getJson(
          "/api/sessions/" + sessionId + "/my-results",
          null,
          Map.of("X-Rejoin-Token", rejoinToken),
          200);

      assertThat(hostEnd.path("totalParticipants").asLong()).isEqualTo(1);
      assertThat(hostEnd.path("leaderboard")).hasSize(1);
      assertThat(hostEnd.path("leaderboard").get(0).path("displayName").asText()).isEqualTo("Lin");
      assertThat(hostEnd.path("leaderboard").get(0).path("score").asLong()).isEqualTo(10);

      ending.get(10, TimeUnit.SECONDS);
    }

    host.disconnect();
  }

  /**
   * Locks the session row from a connection outside the application's transactions. Ending a
   * session writes that row only when it flushes at commit, so the end-of-session transaction runs
   * its whole body and then waits here until this connection lets go.
   */
  private Connection lockSessionRow(long sessionId) throws SQLException {
    Connection connection = dataSource.getConnection();
    connection.setAutoCommit(false);
    try (PreparedStatement lock =
        connection.prepareStatement("SELECT id FROM quiz_sessions WHERE id = ? FOR UPDATE")) {
      lock.setLong(1, sessionId);
      lock.executeQuery().close();
    }
    return connection;
  }

  /** Waits until some other transaction is queued behind a lock that {@code holder} owns. */
  private void awaitBlockedBy(Connection holder) throws Exception {
    int holderPid;
    try (PreparedStatement pid = holder.prepareStatement("SELECT pg_backend_pid()");
        ResultSet row = pid.executeQuery()) {
      row.next();
      holderPid = row.getInt(1);
    }

    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
    while (System.nanoTime() < deadline) {
      Long blocked =
          jdbcTemplate.queryForObject(
              "SELECT count(*) FROM pg_stat_activity WHERE ? = ANY(pg_blocking_pids(pid))",
              Long.class,
              holderPid);
      if (blocked != null && blocked > 0) {
        return;
      }
      Thread.sleep(50);
    }
    throw new AssertionError("The end-of-session transaction never reached its commit");
  }
}
