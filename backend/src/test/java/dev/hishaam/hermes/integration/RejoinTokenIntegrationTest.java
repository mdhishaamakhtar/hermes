package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import dev.hishaam.hermes.util.SessionRedisKeys;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Integration tests for participant rejoin-token recovery paths.
 *
 * <p>This suite covers the Redis-backed fast path and the Postgres fallback path used when a
 * participant returns after the cached token mapping has expired or been removed.
 */
class RejoinTokenIntegrationTest extends BaseIntegrationTest {

  @Autowired private StringRedisTemplate redis;

  /**
   * Verifies that rejoin can recover from a missing Redis token entry by falling back to the
   * persisted participant row and then restoring the cache entry.
   */
  @Test
  void rejoinFallsBackToPostgresWhenRedisTokenEntryIsGoneAndRecachesIt() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Token Fallback Event");
    long quizId = createQuiz(organiser, eventId, "Token Fallback Quiz");
    createSingleSelectQuestion(organiser, quizId, "Question", 1, 30);

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
    long participantId = participant.path("participantId").asLong();

    String tokenKey = SessionRedisKeys.participantTokenKey(rejoinToken);
    assertThat(redis.hasKey(tokenKey)).isTrue();
    // Simulate the 24h Redis TTL expiring while the participant row still exists
    redis.delete(tokenKey);

    JsonNode rejoined =
        postJson(
                "/api/sessions/rejoin",
                null,
                Map.of("rejoinToken", rejoinToken, "sessionId", sessionId),
                200)
            .path("data");
    assertThat(rejoined.path("participantId").asLong()).isEqualTo(participantId);
    assertThat(rejoined.path("status").asText()).isEqualTo("LOBBY");

    assertThat(redis.hasKey(tokenKey)).isTrue();
  }

  /**
   * Verifies that rejoin tokens remain scoped to the original session regardless of whether the
   * lookup happens through Redis or through the database fallback.
   */
  @Test
  void rejoinTokensAreScopedToTheirSessionOnBothRedisAndPostgresPaths() throws Exception {
    Auth organiser = organiser();
    long eventA = createEvent(organiser, "Session A Event");
    long quizA = createQuiz(organiser, eventA, "Session A Quiz");
    createSingleSelectQuestion(organiser, quizA, "Question A", 1, 30);
    long eventB = createEvent(organiser, "Session B Event");
    long quizB = createQuiz(organiser, eventB, "Session B Quiz");
    createSingleSelectQuestion(organiser, quizB, "Question B", 1, 30);

    JsonNode sessionA =
        postJson("/api/sessions", organiser, Map.of("quizId", quizA), 201).path("data");
    long sessionAId = sessionA.path("id").asLong();
    JsonNode sessionB =
        postJson("/api/sessions", organiser, Map.of("quizId", quizB), 201).path("data");
    long sessionBId = sessionB.path("id").asLong();

    JsonNode participant =
        postJson(
                "/api/sessions/join",
                null,
                Map.of("joinCode", sessionA.path("joinCode").asText(), "displayName", "Ada"),
                200)
            .path("data");
    String rejoinToken = participant.path("rejoinToken").asText();

    JsonNode crossSessionViaRedis =
        postJson(
            "/api/sessions/rejoin",
            null,
            Map.of("rejoinToken", rejoinToken, "sessionId", sessionBId),
            404);
    assertThat(crossSessionViaRedis.path("error").path("message").asText())
        .isEqualTo("Invalid rejoin token for this session");

    redis.delete(SessionRedisKeys.participantTokenKey(rejoinToken));
    JsonNode crossSessionViaPostgres =
        postJson(
            "/api/sessions/rejoin",
            null,
            Map.of("rejoinToken", rejoinToken, "sessionId", sessionBId),
            404);
    assertThat(crossSessionViaPostgres.path("error").path("message").asText())
        .isEqualTo("Invalid rejoin token for this session");

    JsonNode unknownToken =
        postJson(
            "/api/sessions/rejoin",
            null,
            Map.of("rejoinToken", "no-such-token-000000000000000000", "sessionId", sessionAId),
            404);
    assertThat(unknownToken.path("error").path("message").asText())
        .isEqualTo("Invalid rejoin token");
  }
}
