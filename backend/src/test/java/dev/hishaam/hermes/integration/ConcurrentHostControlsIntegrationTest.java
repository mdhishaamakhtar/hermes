package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Integration tests for host controls that arrive together: a presenter's clicker sending its key
 * twice, a host with the session open in two tabs. Each control checks the lifecycle and then acts
 * on it in several steps, so without serialisation two overlapping presses both pass the check —
 * two "next" presses skip a question. Requests go over real HTTP so they overlap on the server's
 * own threads.
 */
class ConcurrentHostControlsIntegrationTest extends BaseIntegrationTest {

  private static final int PRESSES = 6;

  private final HttpClient http = HttpClient.newHttpClient();

  /**
   * Verifies that every control pressed several times at once takes effect exactly once: one press
   * succeeds, the rest are refused as conflicts, and the session moves one step, never two.
   */
  @Test
  void simultaneousPressesOfEachControlTakeEffectExactlyOnce() throws Exception {
    Auth organiser = organiser();
    long eventId = createEvent(organiser, "Clicker Event");
    long quizId = createQuiz(organiser, eventId, "Clicker Quiz");
    createSingleSelectQuestion(organiser, quizId, "First", 1, 30);
    createSingleSelectQuestion(organiser, quizId, "Second", 2, 30);
    createSingleSelectQuestion(organiser, quizId, "Third", 3, 30);
    long sessionId =
        postJson("/api/sessions", organiser, Map.of("quizId", quizId), 201)
            .path("data")
            .path("id")
            .asLong();

    assertThat(pressTogether(organiser, sessionId, "start")).containsExactlyInAnyOrder(okOnce());
    assertStage(organiser, sessionId, "DISPLAYED", 1);

    assertThat(pressTogether(organiser, sessionId, "start-timer"))
        .containsExactlyInAnyOrder(okOnce());
    assertStage(organiser, sessionId, "TIMED", 1);

    assertThat(pressTogether(organiser, sessionId, "end-timer"))
        .containsExactlyInAnyOrder(okOnce());
    assertStage(organiser, sessionId, "REVIEWING", 1);

    assertThat(pressTogether(organiser, sessionId, "next")).containsExactlyInAnyOrder(okOnce());
    assertStage(organiser, sessionId, "DISPLAYED", 2);
  }

  /** One success among the presses; every other press is a conflict. */
  private static Integer[] okOnce() {
    Integer[] statuses = new Integer[PRESSES];
    statuses[0] = 200;
    for (int i = 1; i < PRESSES; i++) statuses[i] = 409;
    return statuses;
  }

  private void assertStage(Auth organiser, long sessionId, String lifecycle, int questionNumber)
      throws Exception {
    JsonNode sync =
        getJson("/api/sessions/" + sessionId + "/host-sync", organiser, 200).path("data");
    assertThat(sync.path("questionLifecycle").asText()).isEqualTo(lifecycle);
    assertThat(sync.path("currentQuestion").path("orderIndex").asInt()).isEqualTo(questionNumber);
  }

  /**
   * Sends the same control {@value #PRESSES} times, released together, and returns the statuses.
   */
  private List<Integer> pressTogether(Auth organiser, long sessionId, String control)
      throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(
                URI.create(
                    "http://localhost:" + port + "/api/sessions/" + sessionId + "/" + control))
            .header("Authorization", "Bearer " + organiser.token())
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();

    CountDownLatch ready = new CountDownLatch(PRESSES);
    CountDownLatch go = new CountDownLatch(1);
    try (ExecutorService pool = Executors.newFixedThreadPool(PRESSES)) {
      List<Future<Integer>> presses = new ArrayList<>();
      for (int i = 0; i < PRESSES; i++) {
        presses.add(
            pool.submit(
                () -> {
                  ready.countDown();
                  go.await();
                  return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
                }));
      }
      ready.await();
      go.countDown();
      List<Integer> statuses = new ArrayList<>();
      for (Future<Integer> press : presses) statuses.add(press.get());
      return statuses;
    }
  }
}
