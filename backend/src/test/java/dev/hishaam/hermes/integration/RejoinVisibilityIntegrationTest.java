package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for what a player can learn by rejoining.
 *
 * <p>The rejoin endpoint is public and can be called at any moment — including halfway through the
 * countdown, by a player who never lost their connection at all. So its response must never run
 * ahead of the event stream: no answer key before the question is reviewed, and no tallies the
 * question's display mode is holding back.
 */
class RejoinVisibilityIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that the answer key stays out of the rejoin response while the question is on screen
   * and while its timer runs, and only appears once the question has been reviewed.
   */
  @Test
  void theAnswerKeyIsWithheldUntilTheQuestionIsReviewed() throws Exception {
    Auth organiser = organiser();
    Live live = startSession(organiser, "LIVE");

    JsonNode displayed = rejoinStats(live, live.adaToken());
    assertThat(displayed.path("correctOptionIds")).as("before the timer starts").isEmpty();
    assertThat(displayed.path("optionPoints")).isEmpty();

    postJson("/api/sessions/" + live.sessionId() + "/start-timer", organiser, Map.of(), 200);
    answer(live, live.graceToken(), live.correctOptionId());

    JsonNode timed = rejoinStats(live, live.adaToken());
    assertThat(timed.path("correctOptionIds")).as("while the timer is running").isEmpty();
    assertThat(timed.path("optionPoints")).isEmpty();
    assertThat(timed.path("reviewed").asBoolean()).isFalse();

    postJson("/api/sessions/" + live.sessionId() + "/end-timer", organiser, Map.of(), 200);

    JsonNode reviewed = rejoinStats(live, live.adaToken());
    assertThat(reviewed.path("reviewed").asBoolean()).isTrue();
    assertThat(reviewed.path("correctOptionIds")).hasSize(1);
    assertThat(reviewed.path("correctOptionIds").get(0).asLong()).isEqualTo(live.correctOptionId());
    assertThat(reviewed.path("optionPoints").path(String.valueOf(live.correctOptionId())).asInt())
        .isEqualTo(10);
  }

  /**
   * Verifies that the tallies in a rejoin response follow the display mode exactly as the live
   * stream does during the countdown: LIVE shows the per-option counts, BLIND only how many have
   * answered, and CODE_DISPLAY nothing at all.
   */
  @Test
  void talliesFollowTheDisplayModeWhileTheTimerRuns() throws Exception {
    Auth organiser = organiser();

    Live open = startTimedSessionWithOneAnswer(organiser, "LIVE");
    JsonNode liveStats = rejoinStats(open, open.adaToken());
    assertThat(liveStats.path("counts").path(String.valueOf(open.correctOptionId())).asLong())
        .as("LIVE streams the counts, so a rejoin may show them")
        .isEqualTo(1);
    assertThat(liveStats.path("totalAnswered").asLong()).isEqualTo(1);

    Live blind = startTimedSessionWithOneAnswer(organiser, "BLIND");
    JsonNode blindStats = rejoinStats(blind, blind.adaToken());
    assertThat(blindStats.path("counts"))
        .as("BLIND hides which options are being picked")
        .isEmpty();
    assertThat(blindStats.path("totalAnswered").asLong())
        .as("BLIND still shows how many have answered")
        .isEqualTo(1);

    Live code = startTimedSessionWithOneAnswer(organiser, "CODE_DISPLAY");
    JsonNode codeStats = rejoinStats(code, code.adaToken());
    assertThat(codeStats.path("counts")).isEmpty();
    assertThat(codeStats.path("totalAnswered").asLong())
        .as("CODE_DISPLAY streams nothing until review")
        .isZero();
    assertThat(codeStats.path("totalParticipants").asLong()).isEqualTo(2);
  }

  /**
   * Verifies that once a BLIND question is reviewed the rejoin response carries the full picture —
   * the same distribution {@code ANSWER_REVEAL} broadcasts — along with the standings.
   */
  @Test
  void aReviewedQuestionRevealsItsTalliesAndTheStandings() throws Exception {
    Auth organiser = organiser();
    Live blind = startTimedSessionWithOneAnswer(organiser, "BLIND");
    postJson("/api/sessions/" + blind.sessionId() + "/end-timer", organiser, Map.of(), 200);

    JsonNode rejoin = rejoin(blind, blind.adaToken());
    JsonNode stats = rejoin.path("questionStatsById").path(String.valueOf(blind.questionId()));
    assertThat(stats.path("revealed").asBoolean()).isTrue();
    assertThat(stats.path("counts").path(String.valueOf(blind.correctOptionId())).asLong())
        .isEqualTo(1);
    assertThat(rejoin.path("leaderboard")).hasSize(2);
    assertThat(rejoin.path("leaderboard").get(0).path("displayName").asText()).isEqualTo("Grace");
  }

  private record Live(
      long sessionId, long questionId, long correctOptionId, String adaToken, String graceToken) {}

  /** A started session with its only question on screen and the timer not yet running. */
  private Live startSession(Auth organiser, String displayMode) throws Exception {
    long eventId = createEvent(organiser, displayMode + " Event");
    long quizId = createQuiz(organiser, eventId, displayMode + " Quiz");
    JsonNode question =
        postJson(
                "/api/quizzes/" + quizId + "/questions",
                organiser,
                Map.of(
                    "text",
                    "Question",
                    "orderIndex",
                    1,
                    "timeLimitSeconds",
                    30,
                    "questionType",
                    "SINGLE_SELECT",
                    "displayModeOverride",
                    displayMode,
                    "options",
                    options("Correct", 0, 10, "Wrong", 1, 0)),
                201)
            .path("data");

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String joinCode = session.path("joinCode").asText();
    String adaToken = join(joinCode, "Ada");
    String graceToken = join(joinCode, "Grace");

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    return new Live(
        sessionId,
        question.path("id").asLong(),
        question.path("options").get(0).path("id").asLong(),
        adaToken,
        graceToken);
  }

  /** As {@link #startSession}, with the timer running and Grace's correct answer already in. */
  private Live startTimedSessionWithOneAnswer(Auth organiser, String displayMode) throws Exception {
    Live live = startSession(organiser, displayMode);
    postJson("/api/sessions/" + live.sessionId() + "/start-timer", organiser, Map.of(), 200);
    answer(live, live.graceToken(), live.correctOptionId());
    return live;
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

  private void answer(Live live, String token, long optionId) throws Exception {
    postJson(
        "/api/sessions/" + live.sessionId() + "/answers",
        null,
        Map.of(
            "rejoinToken", token,
            "questionId", live.questionId(),
            "selectedOptionIds", List.of(optionId)),
        200);
  }

  private JsonNode rejoin(Live live, String token) throws Exception {
    return postJson(
            "/api/sessions/rejoin",
            null,
            Map.of("rejoinToken", token, "sessionId", live.sessionId()),
            200)
        .path("data");
  }

  private JsonNode rejoinStats(Live live, String token) throws Exception {
    return rejoin(live, token).path("questionStatsById").path(String.valueOf(live.questionId()));
  }
}
