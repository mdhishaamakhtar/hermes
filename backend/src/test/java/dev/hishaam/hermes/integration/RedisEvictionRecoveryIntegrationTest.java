package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Integration tests for surviving the loss of live session state.
 *
 * <p>Session state lives in Redis under a TTL, while the durable record lives in PostgreSQL. If the
 * TTL lapses or Redis is evicted or restarted mid-session, every read path has to fall back to the
 * database instead of failing or reporting a session that has silently emptied out. Nothing else
 * exercises those fallbacks, because a healthy Redis never misses.
 */
class RedisEvictionRecoveryIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that the lobby participant count survives eviction by falling back to counting rows,
   * rather than reporting an empty room to a host who is watching people arrive.
   */
  @Test
  void lobbyParticipantCountFallsBackToTheDatabaseAfterEviction() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Eviction Lobby Event");
    long quizId = createQuiz(organiser, eventId, "Eviction Lobby Quiz");
    createSingleSelectQuestion(organiser, quizId, "Question", 1, 30);

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String joinCode = session.path("joinCode").asText();
    join(joinCode, "First");
    join(joinCode, "Second");

    assertThat(
            getJson("/api/sessions/" + sessionId + "/lobby", organiser, 200)
                .path("data")
                .path("participantCount")
                .asLong())
        .isEqualTo(2);

    flushRedis();

    JsonNode afterEviction =
        getJson("/api/sessions/" + sessionId + "/lobby", organiser, 200).path("data");
    assertThat(afterEviction.path("participantCount").asLong())
        .as("participants are still in PostgreSQL even when the Redis counter is gone")
        .isEqualTo(2);
    assertThat(afterEviction.path("status").asText()).isEqualTo("LOBBY");
    assertThat(afterEviction.path("joinCode").asText()).isEqualTo(joinCode);
  }

  /**
   * Verifies that a host reconnecting after eviction gets a coherent, degraded view — the session
   * is still reported as running with its real participant count, but with no live question or
   * leaderboard to show, instead of a 500.
   */
  @Test
  void hostSyncDegradesToADatabaseBackedViewWhenLiveStateIsGone() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Eviction Host Event");
    long quizId = createQuiz(organiser, eventId, "Eviction Host Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Question", 1, 30);
    long questionId = question.path("id").asLong();
    long correct = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session.path("joinCode").asText(), "Ada");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    submitAnswer(sessionId, token, questionId, correct);

    flushRedis();

    JsonNode sync =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(sync.path("status").asText())
        .as("the durable session row still knows the session is running")
        .isEqualTo("ACTIVE");
    assertThat(sync.path("participantCount").asLong()).isEqualTo(1);
    assertThat(sync.path("currentQuestion").isNull())
        .as("with live state gone there is no question to point at")
        .isTrue();
    assertThat(sync.path("currentPassage").isNull()).isTrue();
    assertThat(sync.path("questionStatsById")).isEmpty();
    assertThat(sync.path("leaderboard")).isEmpty();
    assertThat(sync.path("timeLeftSeconds").isNull()).isTrue();
  }

  /**
   * Verifies that a participant rejoining after eviction is still recognised and keeps their
   * answered history, which lives in PostgreSQL, even though the live question view is empty.
   */
  @Test
  void participantsStillRejoinWithTheirAnswerHistoryAfterEviction() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Eviction Rejoin Event");
    long quizId = createQuiz(organiser, eventId, "Eviction Rejoin Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Question", 1, 30);
    long questionId = question.path("id").asLong();
    long correct = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session.path("joinCode").asText(), "Ada");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    submitAnswer(sessionId, token, questionId, correct);

    flushRedis();

    JsonNode rejoin =
        postJson(
                "/api/sessions/rejoin",
                null,
                Map.of("rejoinToken", token, "sessionId", sessionId),
                200)
            .path("data");
    assertThat(rejoin.path("status").asText()).isEqualTo("ACTIVE");
    assertThat(rejoin.path("alreadyAnswered"))
        .as("answers are durable, so the participant does not lose their progress")
        .hasSize(1);
    assertThat(rejoin.path("alreadyAnswered").get(0).asLong()).isEqualTo(questionId);
    assertThat(rejoin.path("currentQuestion").isNull()).isTrue();
    assertThat(rejoin.path("currentPassage").isNull()).isTrue();
    assertThat(rejoin.path("leaderboard")).isEmpty();
    assertThat(rejoin.path("sessionTitle").asText())
        .as("the snapshot is reloaded from the durable copy on a cache miss")
        .isEqualTo("Eviction Rejoin Quiz");
  }

  /**
   * Verifies that a host can still close out a session whose live state has been evicted, and that
   * the answers recorded before the eviction are graded into the final results.
   */
  @Test
  void aSessionWhoseStateWasEvictedCanStillBeEndedAndProduceResults() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Eviction End Event");
    long quizId = createQuiz(organiser, eventId, "Eviction End Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Question", 1, 30);
    long questionId = question.path("id").asLong();
    long correct = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session.path("joinCode").asText(), "Ada");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    submitAnswer(sessionId, token, questionId, correct);
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);

    flushRedis();

    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);
    assertThat(
            getJson("/api/sessions/" + sessionId + "/status", organiser, 200).path("data").asText())
        .isEqualTo("ENDED");

    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(results.path("questions")).hasSize(1);
    assertThat(results.path("questions").get(0).path("totalAnswers").asLong()).isEqualTo(1);
    assertThat(results.path("leaderboard")).hasSize(1);
    assertThat(results.path("leaderboard").get(0).path("displayName").asText()).isEqualTo("Ada");
    assertThat(results.path("leaderboard").get(0).path("score").asLong())
        .as("grading happened before eviction and is persisted, not recomputed from Redis")
        .isEqualTo(10);
  }

  /**
   * Verifies that eviction landing mid-question does not cost participants their marks. The Redis
   * lifecycle flag that normally signals "grade this now" is gone, so ending the session has to
   * notice from the durable answers that nothing has been scored yet and grade them anyway.
   */
  @Test
  void answersRecordedBeforeEvictionAreStillGradedWhenTheSessionEnds() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Ungraded Event");
    long quizId = createQuiz(organiser, eventId, "Ungraded Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Question", 1, 30);
    long questionId = question.path("id").asLong();
    long correct = question.path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session.path("joinCode").asText(), "Ada");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    submitAnswer(sessionId, token, questionId, correct);

    // Results are only available once the session has ended.
    assertThat(
            getJson(
                    "/api/sessions/" + sessionId + "/my-results",
                    null,
                    Map.of("X-Rejoin-Token", token),
                    409)
                .path("error")
                .path("message")
                .asText())
        .isEqualTo("Session has not ended yet");
    assertThat(
            getJson("/api/sessions/" + sessionId + "/results", organiser, 409)
                .path("error")
                .path("message")
                .asText())
        .isEqualTo("Session has not ended yet");

    // Eviction happens while the question is still live, then the host stops the session.
    flushRedis();
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(results.path("questions").get(0).path("totalAnswers").asLong())
        .as("the answer itself survived — it is recorded and counted")
        .isEqualTo(1);
    assertThat(results.path("leaderboard").get(0).path("score").asLong())
        .as("a correct answer submitted before the eviction must still score")
        .isEqualTo(10);

    JsonNode mine =
        getJson(
                "/api/sessions/" + sessionId + "/my-results",
                null,
                Map.of("X-Rejoin-Token", token),
                200)
            .path("data");
    assertThat(mine.path("score").asLong()).isEqualTo(10);
    assertThat(mine.path("questions").get(0).path("pointsEarned").asLong()).isEqualTo(10);
    assertThat(mine.path("questions").get(0).path("selectedOptionIds"))
        .as("the participant's selection is still shown back to them")
        .hasSize(1);
  }

  /**
   * Verifies the same recovery for an ENTIRE_PASSAGE block. The session row points at the last
   * sub-question, so ending after an eviction has to recognise the whole block was on screen and
   * grade every sub-question, not just that one.
   */
  @Test
  void anEvictedPassageBlockIsGradedInFullWhenTheSessionEnds() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Eviction Passage Event");
    long quizId = createQuiz(organiser, eventId, "Eviction Passage Quiz");

    JsonNode passage =
        postJson(
                "/api/quizzes/" + quizId + "/passages",
                organiser,
                Map.of(
                    "text",
                    "Passage interrupted by an eviction.",
                    "orderIndex",
                    1,
                    "timerMode",
                    "ENTIRE_PASSAGE",
                    "timeLimitSeconds",
                    120,
                    "subQuestions",
                    List.of(
                        Map.of(
                            "text",
                            "First sub",
                            "orderIndex",
                            0,
                            "questionType",
                            "SINGLE_SELECT",
                            "options",
                            options("Right", 0, 6, "Wrong", 1, 0)),
                        Map.of(
                            "text",
                            "Second sub",
                            "orderIndex",
                            1,
                            "questionType",
                            "SINGLE_SELECT",
                            "options",
                            options("Right", 0, 4, "Wrong", 1, 0)))),
                201)
            .path("data");
    long firstSubId = passage.path("subQuestions").get(0).path("id").asLong();
    long firstCorrect =
        passage.path("subQuestions").get(0).path("options").get(0).path("id").asLong();
    long secondSubId = passage.path("subQuestions").get(1).path("id").asLong();
    long secondCorrect =
        passage.path("subQuestions").get(1).path("options").get(0).path("id").asLong();

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String token = join(session.path("joinCode").asText(), "Ada");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    submitAnswer(sessionId, token, firstSubId, firstCorrect);
    submitAnswer(sessionId, token, secondSubId, secondCorrect);

    flushRedis();
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);

    JsonNode results =
        getJson("/api/sessions/" + sessionId + "/results", organiser, 200).path("data");
    assertThat(results.path("leaderboard").get(0).path("score").asLong())
        .as("every sub-question of the evicted block must be graded, not just the last one")
        .isEqualTo(10);
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
}
