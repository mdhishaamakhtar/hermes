package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for what a finished session leaves the organiser: every player's answers in the
 * session results, and standings added up across an event's rounds.
 */
class ResultsAcrossRoundsIntegrationTest extends BaseIntegrationTest {

  /**
   * Verifies that the results list each player with their rank, score, right answers and picks, and
   * that event standings add each round's latest real session per player, matching a player across
   * rounds by name whatever its case or spacing, and leaving rehearsals out.
   */
  @Test
  void resultsCarryEachPlayerAndTheEventAddsUpItsRounds() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Trivia Night");
    long roundOne = createQuiz(organiser, eventId, "Round one");
    JsonNode first = createSingleSelectQuestion(organiser, roundOne, "First", 0, 30);
    long roundTwo = createQuiz(organiser, eventId, "Round two");
    JsonNode second = createSingleSelectQuestion(organiser, roundTwo, "Second", 0, 30);

    long sessionOne =
        play(organiser, roundOne, first, Map.of("Ada", 0, "Ben", 1), false).path("id").asLong();
    play(organiser, roundTwo, second, Map.of(" ada ", 0, "Cy", 0), false);
    // A rehearsal of round two must not count.
    play(organiser, roundTwo, second, Map.of("Ben", 0), true);

    JsonNode results =
        getJson("/api/sessions/" + sessionOne + "/results", organiser, 200).path("data");
    JsonNode ada = results.path("players").get(0);
    assertThat(ada.path("displayName").asText()).isEqualTo("Ada");
    assertThat(ada.path("rank").asInt()).isEqualTo(1);
    assertThat(ada.path("score").asLong()).isEqualTo(10);
    assertThat(ada.path("correctCount").asInt()).isEqualTo(1);
    assertThat(ada.path("answers").get(0).path("correct").asBoolean()).isTrue();
    assertThat(results.path("players").get(1).path("correctCount").asInt()).isZero();

    JsonNode standings =
        getJson("/api/events/" + eventId + "/standings", organiser, 200).path("data");
    assertThat(standings.path("rounds"))
        .extracting(round -> round.path("quizTitle").asText())
        .containsExactly("Round one", "Round two");
    JsonNode leader = standings.path("standings").get(0);
    assertThat(leader.path("displayName").asText()).isEqualTo("Ada");
    assertThat(leader.path("total").asLong()).isEqualTo(20);
    assertThat(standings.path("standings").get(1).path("displayName").asText()).isEqualTo("Cy");
    JsonNode ben = standings.path("standings").get(2);
    assertThat(ben.path("total").asLong()).isZero();
    assertThat(ben.path("roundScores").get(1).isNull()).isTrue();
  }

  /** Runs one question to the end with the given players and their picks (option positions). */
  private JsonNode play(
      Auth organiser, long quizId, JsonNode question, Map<String, Integer> picks, boolean rehearsal)
      throws Exception {
    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId, "rehearsal", rehearsal), 201)
            .path("data");
    long sessionId = session.path("id").asLong();
    Map<String, String> tokens = new LinkedHashMap<>();
    for (String name : picks.keySet()) {
      tokens.put(
          name,
          postJson(
                  "/api/sessions/join",
                  null,
                  Map.of("joinCode", session.path("joinCode").asText(), "displayName", name),
                  200)
              .path("data")
              .path("rejoinToken")
              .asText());
    }
    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    for (Map.Entry<String, Integer> pick : picks.entrySet()) {
      postJson(
          "/api/sessions/" + sessionId + "/answers",
          null,
          Map.of(
              "rejoinToken",
              tokens.get(pick.getKey()),
              "questionId",
              question.path("id").asLong(),
              "selectedOptionIds",
              List.of(question.path("options").get(pick.getValue()).path("id").asLong())),
          200);
    }
    postJson("/api/sessions/" + sessionId + "/end-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/end", organiser, Map.of(), 200);
    return session;
  }
}
