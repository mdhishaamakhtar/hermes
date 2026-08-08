package dev.hishaam.hermes.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.fasterxml.jackson.databind.JsonNode;
import dev.hishaam.hermes.support.BaseIntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Integration tests for authentication and CRUD endpoints.
 *
 * <p>This suite exercises the API boundary end to end: registration and login, plus event, quiz,
 * question, and passage lifecycle operations with ownership and validation rules enforced by the
 * HTTP layer.
 */
class AuthAndCrudIntegrationTest extends BaseIntegrationTest {

  /** Verifies registration, login, and the current-user endpoint for an organiser account. */
  @Test
  void authEndpointsRegisterLoginAndReturnCurrentUser() throws Exception {
    Auth auth = organiser();

    JsonNode me = getJson("/api/auth/me", auth, 200).path("data");

    assertThat(me.path("id").asLong()).isEqualTo(auth.userId());
    assertThat(me.path("email").asText()).isEqualTo(auth.email());
    assertThat(me.path("displayName").asText()).startsWith("Organiser");

    JsonNode duplicate =
        postJson(
            "/api/auth/register",
            null,
            Map.of("email", auth.email(), "password", "correct-horse-25", "displayName", "Dup"),
            409);
    assertThat(duplicate.path("success").asBoolean()).isFalse();
    assertThat(duplicate.path("error").path("code").asText()).isEqualTo("CONFLICT");

    JsonNode badLogin =
        postJson(
            "/api/auth/login", null, Map.of("email", auth.email(), "password", "wrong-pass"), 401);
    assertThat(badLogin.path("error").path("message").asText()).isEqualTo("Invalid credentials");
  }

  /**
   * Verifies that a quiz owner can create, update, fetch, and delete events, quizzes, questions,
   * and passages through the public REST API, while a different organiser is blocked from access.
   */
  @Test
  void organiserOwnsEventsQuizzesQuestionsAndPassagesThroughCrudLifecycle() throws Exception {
    Auth owner = organiser();
    Auth other = organiser();

    long eventId = createEvent(owner, "Backend Round");
    JsonNode listedEvents = getJson("/api/events", owner, 200).path("data");
    assertThat(listedEvents).hasSize(1);
    assertThat(listedEvents.get(0).path("title").asText()).isEqualTo("Backend Round");

    JsonNode updatedEvent =
        putJson(
                "/api/events/" + eventId,
                owner,
                Map.of("title", "Backend Finals", "description", "Updated"),
                200)
            .path("data");
    assertThat(updatedEvent.path("title").asText()).isEqualTo("Backend Finals");
    assertThat(updatedEvent.path("description").asText()).isEqualTo("Updated");

    JsonNode forbidden = getJson("/api/events/" + eventId, other, 403);
    assertThat(forbidden.path("error").path("code").asText()).isEqualTo("FORBIDDEN");

    long quizId = createQuiz(owner, eventId, "JVM and Spring");
    JsonNode quiz =
        putJson(
                "/api/quizzes/" + quizId,
                owner,
                Map.of("title", "JVM, Spring, Redis", "orderIndex", 2, "displayMode", "LIVE"),
                200)
            .path("data");
    assertThat(quiz.path("title").asText()).isEqualTo("JVM, Spring, Redis");
    assertThat(quiz.path("displayMode").asText()).isEqualTo("LIVE");

    JsonNode single = createSingleSelectQuestion(owner, quizId, "Pick Java 25 feature", 1, 30);
    assertThat(single.path("questionType").asText()).isEqualTo("SINGLE_SELECT");
    assertThat(single.path("options")).hasSize(2);
    assertThat(single.path("options").get(0).path("text").asText()).isEqualTo("Correct");
    long singleQuestionId = single.path("id").asLong();

    JsonNode multi = createMultiSelectQuestion(owner, quizId, "Pick Spring components", 2, 35);
    assertThat(multi.path("questionType").asText()).isEqualTo("MULTI_SELECT");
    assertThat(multi.path("options")).hasSize(3);

    JsonNode updatedQuestion =
        putJson(
                "/api/questions/" + singleQuestionId,
                owner,
                Map.of(
                    "text",
                    "Pick the LTS runtime",
                    "orderIndex",
                    1,
                    "timeLimitSeconds",
                    25,
                    "questionType",
                    "SINGLE_SELECT",
                    "displayModeOverride",
                    "CODE_DISPLAY",
                    "options",
                    options("Java 25", 0, 10, "Java 8", 1, 0)),
                200)
            .path("data");
    assertThat(updatedQuestion.path("text").asText()).isEqualTo("Pick the LTS runtime");
    assertThat(updatedQuestion.path("effectiveDisplayMode").asText()).isEqualTo("CODE_DISPLAY");

    JsonNode passage =
        postJson(
                "/api/quizzes/" + quizId + "/passages",
                owner,
                Map.of(
                    "text",
                    "Read the Redis-backed session description.",
                    "orderIndex",
                    3,
                    "timerMode",
                    "ENTIRE_PASSAGE",
                    "timeLimitSeconds",
                    45,
                    "subQuestions",
                    new Object[] {
                      Map.of(
                          "text",
                          "What stores leaderboard data?",
                          "orderIndex",
                          0,
                          "questionType",
                          "SINGLE_SELECT",
                          "options",
                          options("Redis", 0, 10, "Postgres only", 1, 0)),
                      Map.of(
                          "text",
                          "Which path receives snapshots?",
                          "orderIndex",
                          1,
                          "questionType",
                          "SINGLE_SELECT",
                          "options",
                          options("Session snapshot", 0, 10, "Static assets", 1, 0))
                    }),
                201)
            .path("data");
    assertThat(passage.path("timerMode").asText()).isEqualTo("ENTIRE_PASSAGE");
    assertThat(passage.path("timeLimitSeconds").asInt()).isEqualTo(45);
    assertThat(passage.path("subQuestions")).hasSize(2);
    long passageId = passage.path("id").asLong();

    JsonNode addedSubQuestion =
        postJson(
                "/api/passages/" + passageId + "/questions",
                owner,
                Map.of(
                    "text",
                    "Extra passage question",
                    "orderIndex",
                    2,
                    "questionType",
                    "SINGLE_SELECT",
                    "options",
                    options("A", 0, 1, "B", 1, 0)),
                201)
            .path("data");
    assertThat(addedSubQuestion.path("passageId").asLong()).isEqualTo(passageId);

    JsonNode fetchedQuiz = getJson("/api/quizzes/" + quizId, owner, 200).path("data");
    assertThat(fetchedQuiz.path("questions")).hasSize(2);
    assertThat(fetchedQuiz.path("passages")).hasSize(1);
    assertThat(fetchedQuiz.path("passages").get(0).path("subQuestions")).hasSize(3);

    deleteJson("/api/questions/" + singleQuestionId, owner, 200);
    deleteJson("/api/passages/" + passageId, owner, 200);
    deleteJson("/api/quizzes/" + quizId, owner, 200);
    deleteJson("/api/events/" + eventId, owner, 200);

    assertThat(getJson("/api/events", owner, 200).path("data")).isEmpty();
  }

  /**
   * Verifies that the API enforces quiz editing rules, question order uniqueness, single-select
   * correctness constraints, and passage timer validation at the boundary.
   */
  @Test
  void validatesQuestionAndPassageBusinessRulesAtApiBoundary() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Validation Event");
    long quizId = createQuiz(owner, eventId, "Validation Quiz");
    createSingleSelectQuestion(owner, quizId, "Existing order", 1, 20);

    JsonNode duplicateOrder =
        postJson(
            "/api/quizzes/" + quizId + "/questions",
            owner,
            Map.of(
                "text",
                "Duplicate order",
                "orderIndex",
                1,
                "timeLimitSeconds",
                20,
                "questionType",
                "SINGLE_SELECT",
                "options",
                options("Yes", 0, 1, "No", 1, 0)),
            400);
    assertThat(duplicateOrder.path("error").path("message").asText())
        .isEqualTo("orderIndex must be unique within the quiz");

    JsonNode invalidSingleSelect =
        postJson(
            "/api/quizzes/" + quizId + "/questions",
            owner,
            Map.of(
                "text",
                "Too many correct options",
                "orderIndex",
                2,
                "timeLimitSeconds",
                20,
                "questionType",
                "SINGLE_SELECT",
                "options",
                options("A", 0, 1, "B", 1, 1)),
            400);
    assertThat(invalidSingleSelect.path("error").path("message").asText())
        .isEqualTo("SINGLE_SELECT questions must have exactly one option with pointValue > 0");

    JsonNode invalidPassage =
        postJson(
            "/api/quizzes/" + quizId + "/passages",
            owner,
            Map.of(
                "text",
                "Timed passage without a timer",
                "orderIndex",
                3,
                "timerMode",
                "ENTIRE_PASSAGE",
                "subQuestions",
                new Object[] {
                  Map.of(
                      "text",
                      "Sub question",
                      "orderIndex",
                      0,
                      "questionType",
                      "SINGLE_SELECT",
                      "options",
                      options("A", 0, 1, "B", 1, 0))
                }),
            400);
    assertThat(invalidPassage.path("error").path("message").asText())
        .isEqualTo("ENTIRE_PASSAGE passages must define a positive timeLimitSeconds");
  }

  /**
   * Verifies quiz-session listing works for the owner and that ending an in-progress session
   * releases the quiz for editing again.
   */
  @Test
  void quizSessionListingAndAbandonCleanupUnlocksQuizEditing() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Session Admin Event");
    long quizId = createQuiz(owner, eventId, "Session Admin Quiz");
    createSingleSelectQuestion(owner, quizId, "Question", 1, 15);

    JsonNode session = postJson("/api/sessions", owner, Map.of("quizId", quizId), 201).path("data");
    long sessionId = session.path("id").asLong();
    String joinCode = session.path("joinCode").asText();

    JsonNode sessions = getJson("/api/quizzes/" + quizId + "/sessions", owner, 200).path("data");
    assertThat(sessions).hasSize(1);
    assertThat(sessions.get(0).path("id").asLong()).isEqualTo(sessionId);
    assertThat(sessions.get(0).path("status").asText()).isEqualTo("LOBBY");
    assertThat(sessions.get(0).path("participantCount").asLong()).isZero();

    JsonNode blockedEdit =
        putJson(
            "/api/quizzes/" + quizId,
            owner,
            Map.of("title", "Blocked edit", "orderIndex", 1, "displayMode", "LIVE"),
            409);
    assertThat(blockedEdit.path("error").path("message").asText())
        .isEqualTo("Quiz has an active session and cannot be edited.");

    deleteJson("/api/sessions/" + sessionId, owner, 200);
    JsonNode missingStatus = getJson("/api/sessions/" + sessionId + "/status", owner, 404);
    assertThat(missingStatus.path("error").path("message").asText()).isEqualTo("Session not found");

    JsonNode joinAfterAbandon =
        postJson(
            "/api/sessions/join", null, Map.of("joinCode", joinCode, "displayName", "Late"), 404);
    assertThat(joinAfterAbandon.path("error").path("message").asText())
        .isEqualTo("Session not found");

    JsonNode updatedQuiz =
        putJson(
                "/api/quizzes/" + quizId,
                owner,
                Map.of("title", "Editable again", "orderIndex", 1, "displayMode", "LIVE"),
                200)
            .path("data");
    assertThat(updatedQuiz.path("title").asText()).isEqualTo("Editable again");
    assertThat(updatedQuiz.path("displayMode").asText()).isEqualTo("LIVE");
  }

  /**
   * Verifies passage editing rules that the question-level tests do not reach: sub-question order
   * uniqueness inside a passage, passage order indexes competing with both standalone questions and
   * sibling passages, and the update/delete paths staying open until a session locks the quiz.
   */
  @Test
  void passageEditingEnforcesSubQuestionAndQuizLevelOrderUniqueness() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Passage Rules Event");
    long quizId = createQuiz(owner, eventId, "Passage Rules Quiz");
    createSingleSelectQuestion(owner, quizId, "Standalone at order 1", 1, 20);

    JsonNode duplicateSubOrder =
        postJson(
            "/api/quizzes/" + quizId + "/passages",
            owner,
            passageBody("Clashing sub-questions", 2, subQuestion("A", 0), subQuestion("B", 0)),
            400);
    assertThat(duplicateSubOrder.path("error").path("message").asText())
        .isEqualTo("Sub-question orderIndex values must be unique within the passage");

    // orderIndex 1 is already taken by a standalone question — passages share that number space.
    JsonNode clashesWithQuestion =
        postJson(
            "/api/quizzes/" + quizId + "/passages",
            owner,
            passageBody("Clashes with a question", 1, subQuestion("A", 0)),
            400);
    assertThat(clashesWithQuestion.path("error").path("message").asText())
        .isEqualTo("orderIndex must be unique within the quiz");

    long passageId =
        postJson(
                "/api/quizzes/" + quizId + "/passages",
                owner,
                passageBody("First passage", 2, subQuestion("A", 0), subQuestion("B", 1)),
                201)
            .path("data")
            .path("id")
            .asLong();

    JsonNode clashesWithPassage =
        postJson(
            "/api/quizzes/" + quizId + "/passages",
            owner,
            passageBody("Clashes with a passage", 2, subQuestion("A", 0)),
            400);
    assertThat(clashesWithPassage.path("error").path("message").asText())
        .isEqualTo("orderIndex must be unique within the quiz");

    // Updating a passage in place must not treat the passage's own index as a clash.
    JsonNode updated =
        putJson(
                "/api/passages/" + passageId,
                owner,
                Map.of(
                    "text",
                    "First passage, revised",
                    "orderIndex",
                    2,
                    "timerMode",
                    "ENTIRE_PASSAGE",
                    "timeLimitSeconds",
                    45),
                200)
            .path("data");
    assertThat(updated.path("text").asText()).isEqualTo("First passage, revised");
    assertThat(updated.path("timeLimitSeconds").asInt()).isEqualTo(45);

    JsonNode movedOntoQuestion =
        putJson(
            "/api/passages/" + passageId,
            owner,
            Map.of(
                "text",
                "Moved onto a question",
                "orderIndex",
                1,
                "timerMode",
                "ENTIRE_PASSAGE",
                "timeLimitSeconds",
                45),
            400);
    assertThat(movedOntoQuestion.path("error").path("message").asText())
        .isEqualTo("orderIndex must be unique within the quiz");
  }

  /**
   * Verifies that an open session freezes passage structure: once a session exists for the quiz,
   * creating, updating, and deleting passages are all refused until it is cleared.
   */
  @Test
  void passageCreateUpdateAndDeleteAreBlockedWhileTheQuizHasAnOpenSession() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Locked Passage Event");
    long quizId = createQuiz(owner, eventId, "Locked Passage Quiz");
    createSingleSelectQuestion(owner, quizId, "Standalone", 1, 20);
    long passageId =
        postJson(
                "/api/quizzes/" + quizId + "/passages",
                owner,
                passageBody("Editable while idle", 2, subQuestion("A", 0)),
                201)
            .path("data")
            .path("id")
            .asLong();

    long sessionId =
        postJson("/api/sessions", owner, Map.of("quizId", quizId), 201)
            .path("data")
            .path("id")
            .asLong();

    String locked = "Quiz has an active session and cannot be edited.";
    assertThat(
            postJson(
                    "/api/quizzes/" + quizId + "/passages",
                    owner,
                    passageBody("Blocked", 3, subQuestion("A", 0)),
                    409)
                .path("error")
                .path("message")
                .asText())
        .isEqualTo(locked);

    Map<String, Object> update =
        Map.of(
            "text",
            "Blocked update",
            "orderIndex",
            2,
            "timerMode",
            "ENTIRE_PASSAGE",
            "timeLimitSeconds",
            30);
    assertThat(
            putJson("/api/passages/" + passageId, owner, update, 409)
                .path("error")
                .path("message")
                .asText())
        .isEqualTo(locked);

    assertThat(
            deleteJson("/api/passages/" + passageId, owner, 409)
                .path("error")
                .path("message")
                .asText())
        .isEqualTo(locked);

    // Abandoning the session releases the quiz, and the delete then succeeds.
    deleteJson("/api/sessions/" + sessionId, owner, 200);
    deleteJson("/api/passages/" + passageId, owner, 200);
    assertThat(getJson("/api/quizzes/" + quizId, owner, 200).path("data").path("passages"))
        .isEmpty();
  }

  /**
   * Verifies that ownership is enforced one level down from events too: a second organiser who
   * knows the id of someone else's quiz, question, or passage is refused on both read and write.
   */
  @Test
  void quizzesQuestionsAndPassagesAreInvisibleToOtherOrganisers() throws Exception {
    Auth owner = organiser();
    Auth intruder = organiser();
    long eventId = createEvent(owner, "Private Event");
    long quizId = createQuiz(owner, eventId, "Private Quiz");
    long questionId =
        createSingleSelectQuestion(owner, quizId, "Private question", 1, 20).path("id").asLong();
    long passageId =
        postJson(
                "/api/quizzes/" + quizId + "/passages",
                owner,
                passageBody("Private passage", 2, subQuestion("A", 0)),
                201)
            .path("data")
            .path("id")
            .asLong();

    assertThat(getJson("/api/quizzes/" + quizId, intruder, 403).path("error").path("code").asText())
        .isEqualTo("FORBIDDEN");
    deleteJson("/api/quizzes/" + quizId, intruder, 403);

    putJson(
        "/api/questions/" + questionId,
        intruder,
        Map.of(
            "text",
            "Hijacked",
            "orderIndex",
            1,
            "timeLimitSeconds",
            20,
            "questionType",
            "SINGLE_SELECT",
            "options",
            options("A", 0, 1, "B", 1, 0)),
        403);
    deleteJson("/api/questions/" + questionId, intruder, 403);

    putJson(
        "/api/passages/" + passageId,
        intruder,
        Map.of("text", "Hijacked passage", "orderIndex", 2),
        403);
    deleteJson("/api/passages/" + passageId, intruder, 403);

    // Nothing the intruder attempted changed anything.
    JsonNode quiz = getJson("/api/quizzes/" + quizId, owner, 200).path("data");
    assertThat(quiz.path("questions")).hasSize(1);
    assertThat(quiz.path("passages")).hasSize(1);
    assertThat(quiz.path("questions").get(0).path("text").asText()).isEqualTo("Private question");
  }

  /**
   * Verifies the JWT filter's two rejection paths: a request with no Authorization header at all,
   * and one carrying a Bearer token that does not verify.
   */
  @Test
  void protectedEndpointsRejectMissingAndUnverifiableTokens() throws Exception {
    Auth owner = organiser();
    long eventId = createEvent(owner, "Guarded Event");

    // No Authorization header — `perform` omits it entirely when auth is null.
    getJson("/api/events/" + eventId, null, 401);
    getJson("/api/auth/me", null, 401);

    // A Bearer token that is not a verifiable JWT is treated as no credential at all.
    assertThat(
            mockMvc
                .perform(
                    get("/api/events/" + eventId).header("Authorization", "Bearer not.a.real.jwt"))
                .andReturn()
                .getResponse()
                .getStatus())
        .isEqualTo(401);

    // A token in a scheme the filter does not handle is ignored rather than misread.
    assertThat(
            mockMvc
                .perform(get("/api/events/" + eventId).header("Authorization", "Basic abc123"))
                .andReturn()
                .getResponse()
                .getStatus())
        .isEqualTo(401);

    // The owner's real token still works, so the endpoint itself is fine.
    assertThat(getJson("/api/events/" + eventId, owner, 200).path("data").path("title").asText())
        .isEqualTo("Guarded Event");
  }

  private static Map<String, Object> passageBody(
      String text, int orderIndex, Object... subQuestions) {
    return Map.of(
        "text", text,
        "orderIndex", orderIndex,
        "timerMode", "ENTIRE_PASSAGE",
        "timeLimitSeconds", 60,
        "subQuestions", subQuestions);
  }

  private static Map<String, Object> subQuestion(String text, int orderIndex) {
    return Map.of(
        "text",
        text,
        "orderIndex",
        orderIndex,
        "questionType",
        "SINGLE_SELECT",
        "options",
        options("Right", 0, 10, "Wrong", 1, 0));
  }
}
