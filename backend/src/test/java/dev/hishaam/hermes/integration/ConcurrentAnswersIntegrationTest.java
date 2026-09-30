package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for answers arriving at the same time.
 *
 * <p>A live question is exactly that situation: everyone answers inside the same few seconds, and a
 * player's client resends over HTTP whenever a WebSocket acknowledgement is slow, so the same
 * answer can be in flight twice. The live tallies are moved by the difference between a
 * participant's previous and new selection, which only adds up if those moves never interleave.
 */
class ConcurrentAnswersIntegrationTest extends BaseIntegrationTest {

  private static final int PLAYERS = 24;

  /**
   * Verifies that a room answering all at once is counted exactly: every answer lands, the tallies
   * add up to the room, and everyone who was right is scored.
   */
  @Test
  void aRoomAnsweringAtOnceIsTalliedExactly() throws Exception {
    Auth organiser = organiser();
    Live live = startTimedSession(organiser, PLAYERS);

    List<Callable<Integer>> submissions = new ArrayList<>();
    for (int i = 0; i < PLAYERS; i++) {
      long optionId = i % 3 == 0 ? live.wrongOptionId() : live.correctOptionId();
      String token = live.tokens().get(i);
      submissions.add(() -> answerStatus(live, token, optionId));
    }
    assertThat(runTogether(submissions)).containsOnly(200);

    JsonNode stats = hostStats(organiser, live);
    assertThat(stats.path("totalAnswered").asLong()).isEqualTo(PLAYERS);
    assertThat(stats.path("counts").path(String.valueOf(live.wrongOptionId())).asLong())
        .isEqualTo(8);
    assertThat(stats.path("counts").path(String.valueOf(live.correctOptionId())).asLong())
        .isEqualTo(16);

    postJson("/api/sessions/" + live.sessionId() + "/end-timer", organiser, Map.of(), 200);
    postJson("/api/sessions/" + live.sessionId() + "/end", organiser, Map.of(), 200);

    JsonNode leaderboard =
        getJson("/api/sessions/" + live.sessionId() + "/results", organiser, 200)
            .path("data")
            .path("leaderboard");
    assertThat(leaderboard).hasSize(PLAYERS);
    long scorers = 0;
    for (JsonNode entry : leaderboard) {
      if (entry.path("score").asLong() == 10) scorers++;
    }
    assertThat(scorers).isEqualTo(16);
  }

  /**
   * Verifies that one participant's duplicated submissions count once. The same first answer is
   * sent from several connections together — all but one may be turned away as a conflict — and
   * then the same change of mind likewise; after each burst the participant holds exactly one
   * selection in the tallies, never two and never a negative.
   */
  @Test
  void oneParticipantsDuplicateSubmissionsAreCountedOnce() throws Exception {
    Auth organiser = organiser();
    Live live = startTimedSession(organiser, 1);
    String token = live.tokens().getFirst();

    List<Integer> firstAnswer = runTogether(duplicates(live, token, live.correctOptionId()));
    assertThat(firstAnswer).contains(200).isSubsetOf(200, 409);

    JsonNode afterFirst = hostStats(organiser, live);
    assertThat(afterFirst.path("totalAnswered").asLong()).isEqualTo(1);
    assertThat(afterFirst.path("counts").path(String.valueOf(live.correctOptionId())).asLong())
        .isEqualTo(1);

    List<Integer> change = runTogether(duplicates(live, token, live.wrongOptionId()));
    assertThat(change).containsOnly(200);

    JsonNode afterChange = hostStats(organiser, live);
    assertThat(afterChange.path("totalAnswered").asLong()).isEqualTo(1);
    assertThat(afterChange.path("counts").path(String.valueOf(live.correctOptionId())).asLong())
        .as("the dropped option gives its single count back, once")
        .isZero();
    assertThat(afterChange.path("counts").path(String.valueOf(live.wrongOptionId())).asLong())
        .as("the new option gains a single count, however many copies arrived")
        .isEqualTo(1);
  }

  private record Live(
      long sessionId,
      long questionId,
      long correctOptionId,
      long wrongOptionId,
      List<String> tokens) {}

  private Live startTimedSession(Auth organiser, int players) throws Exception {
    long eventId = createEvent(organiser, "Concurrency Event");
    long quizId = createQuiz(organiser, eventId, "Concurrency Quiz");
    JsonNode question = createSingleSelectQuestion(organiser, quizId, "Everyone at once", 1, 60);

    JsonNode session =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    List<String> tokens = new ArrayList<>();
    for (int i = 0; i < players; i++) {
      tokens.add(
          postJson(
                  "/api/sessions/join",
                  null,
                  Map.of(
                      "joinCode", session.path("joinCode").asText(), "displayName", "Player " + i),
                  200)
              .path("data")
              .path("rejoinToken")
              .asText());
    }

    postJson("/api/sessions/" + sessionId + "/start", organiser, Map.of(), 200);
    postJson("/api/sessions/" + sessionId + "/start-timer", organiser, Map.of(), 200);
    return new Live(
        sessionId,
        question.path("id").asLong(),
        question.path("options").get(0).path("id").asLong(),
        question.path("options").get(1).path("id").asLong(),
        tokens);
  }

  private List<Callable<Integer>> duplicates(Live live, String token, long optionId) {
    List<Callable<Integer>> copies = new ArrayList<>();
    for (int i = 0; i < 6; i++) {
      copies.add(() -> answerStatus(live, token, optionId));
    }
    return copies;
  }

  private int answerStatus(Live live, String token, long optionId) throws Exception {
    return mockMvc
        .perform(
            post("/api/sessions/" + live.sessionId() + "/answers")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        Map.of(
                            "rejoinToken", token,
                            "questionId", live.questionId(),
                            "selectedOptionIds", List.of(optionId)))))
        .andReturn()
        .getResponse()
        .getStatus();
  }

  /** Releases every task from the same starting gun and returns their HTTP statuses. */
  private List<Integer> runTogether(List<Callable<Integer>> tasks) throws Exception {
    CountDownLatch startingGun = new CountDownLatch(1);
    try (ExecutorService pool = Executors.newFixedThreadPool(tasks.size())) {
      List<Future<Integer>> pending = new ArrayList<>();
      for (Callable<Integer> task : tasks) {
        pending.add(
            pool.submit(
                () -> {
                  startingGun.await();
                  return task.call();
                }));
      }
      startingGun.countDown();
      List<Integer> statuses = new ArrayList<>();
      for (Future<Integer> result : pending) {
        statuses.add(result.get());
      }
      return statuses;
    }
  }

  private JsonNode hostStats(Auth organiser, Live live) throws Exception {
    return getJson("/api/sessions/" + live.sessionId() + "/host-sync", organiser, 200)
        .path("data")
        .path("questionStatsById")
        .path(String.valueOf(live.questionId()));
  }
}
