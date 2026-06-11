package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.hishaam.hermes.dto.OptionRequest;
import dev.hishaam.hermes.entity.Passage;
import dev.hishaam.hermes.entity.Question;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionType;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.service.QuestionService;
import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link QuestionService#validateQuestionRequest}.
 *
 * <p>This class exercises every exception branch in the private validation method: option count,
 * blank text, point-value rules per question type, duplicate order indexes, per-sub-question timer
 * enforcement, and quiz-level / passage-level order-index uniqueness. No database, Redis, or Spring
 * context is involved.
 */
class QuestionServiceValidationTest {

  private static Method validateMethod;

  @BeforeAll
  static void resolveMethod() throws Exception {
    validateMethod =
        QuestionService.class.getDeclaredMethod(
            "validateQuestionRequest",
            Quiz.class,
            Passage.class,
            int.class,
            QuestionType.class,
            int.class,
            List.class,
            Long.class);
    validateMethod.setAccessible(true);
  }

  private static void invokeValidate(
      Quiz quiz,
      Passage passage,
      int orderIndex,
      QuestionType questionType,
      int timeLimitSeconds,
      List<OptionRequest> optionRequests,
      Long currentQuestionId) {
    try {
      QuestionService service = new QuestionService(null, null, null);
      validateMethod.invoke(
          service,
          quiz,
          passage,
          orderIndex,
          questionType,
          timeLimitSeconds,
          optionRequests,
          currentQuestionId);
    } catch (Exception e) {
      if (e.getCause() instanceof AppException ae) {
        throw ae;
      }
      if (e instanceof AppException ae) {
        throw ae;
      }
      throw new RuntimeException(e);
    }
  }

  private static Quiz quizWithQuestion(int orderIndex, Long questionId) {
    Question q = Question.builder().id(questionId).text("Existing").orderIndex(orderIndex).build();
    Quiz quiz = Quiz.builder().id(1L).title("Quiz").build();
    quiz.getQuestions().add(q);
    return quiz;
  }

  private static Quiz quizWithPassage(int orderIndex) {
    Passage p = Passage.builder().id(10L).text("Existing Passage").orderIndex(orderIndex).build();
    Quiz quiz = Quiz.builder().id(1L).title("Quiz").build();
    quiz.getPassages().add(p);
    return quiz;
  }

  private static Passage passageWithSubQuestion(int orderIndex, Long questionId) {
    Question sub = Question.builder().id(questionId).text("Sub").orderIndex(orderIndex).build();
    Passage passage =
        Passage.builder()
            .id(20L)
            .text("Passage")
            .timerMode(PassageTimerMode.PER_SUB_QUESTION)
            .build();
    passage.getSubQuestions().add(sub);
    return passage;
  }

  /** Verifies that fewer than two options always produces a {@code BAD_REQUEST}. */
  @Test
  void rejectsWhenFewerThanTwoOptions() {
    assertThatThrownBy(
            () ->
                invokeValidate(
                    Quiz.builder().id(1L).title("Q").build(),
                    null,
                    1,
                    QuestionType.SINGLE_SELECT,
                    30,
                    List.of(new OptionRequest("Only", 0, 5)),
                    null))
        .isInstanceOf(AppException.class)
        .hasMessageContaining("at least 2 options");
  }

  /** Verifies that blank or whitespace-only option text is rejected. */
  @Test
  void rejectsBlankOptionText() {
    assertThatThrownBy(
            () ->
                invokeValidate(
                    Quiz.builder().id(1L).title("Q").build(),
                    null,
                    1,
                    QuestionType.SINGLE_SELECT,
                    30,
                    List.of(new OptionRequest("  ", 0, 5), new OptionRequest("Valid", 1, 0)),
                    null))
        .isInstanceOf(AppException.class)
        .hasMessageContaining("Option text is required");
  }

  /** Verifies that {@code SINGLE_SELECT} questions must have exactly one positive option. */
  @Test
  void singleSelectRequiresExactlyOnePositiveOption() {
    assertThatThrownBy(
            () ->
                invokeValidate(
                    Quiz.builder().id(1L).title("Q").build(),
                    null,
                    1,
                    QuestionType.SINGLE_SELECT,
                    30,
                    List.of(new OptionRequest("A", 0, 5), new OptionRequest("B", 1, 3)),
                    null))
        .isInstanceOf(AppException.class)
        .hasMessageContaining("exactly one option with pointValue > 0");

    assertThatThrownBy(
            () ->
                invokeValidate(
                    Quiz.builder().id(1L).title("Q").build(),
                    null,
                    1,
                    QuestionType.SINGLE_SELECT,
                    30,
                    List.of(new OptionRequest("A", 0, 0), new OptionRequest("B", 1, 0)),
                    null))
        .isInstanceOf(AppException.class)
        .hasMessageContaining("exactly one option with pointValue > 0");
  }

  /** Verifies that {@code MULTI_SELECT} questions must have at least one positive option. */
  @Test
  void multiSelectRequiresAtLeastOnePositiveOption() {
    assertThatThrownBy(
            () ->
                invokeValidate(
                    Quiz.builder().id(1L).title("Q").build(),
                    null,
                    1,
                    QuestionType.MULTI_SELECT,
                    30,
                    List.of(new OptionRequest("A", 0, 0), new OptionRequest("B", 1, 0)),
                    null))
        .isInstanceOf(AppException.class)
        .hasMessageContaining("at least one option with pointValue > 0");
  }

  /** Verifies that duplicate order-index values within a single question are rejected. */
  @Test
  void rejectsDuplicateOptionOrderIndexes() {
    assertThatThrownBy(
            () ->
                invokeValidate(
                    Quiz.builder().id(1L).title("Q").build(),
                    null,
                    1,
                    QuestionType.SINGLE_SELECT,
                    30,
                    List.of(new OptionRequest("A", 0, 5), new OptionRequest("B", 0, 0)),
                    null))
        .isInstanceOf(AppException.class)
        .hasMessageContaining("orderIndex values must be unique within the question");
  }

  /** Verifies that standalone questions must define a positive timeLimitSeconds. */
  @Test
  void standaloneQuestionRequiresPositiveTimeLimit() {
    assertThatThrownBy(
            () ->
                invokeValidate(
                    Quiz.builder().id(1L).title("Q").build(),
                    null,
                    1,
                    QuestionType.SINGLE_SELECT,
                    0,
                    List.of(new OptionRequest("A", 0, 5), new OptionRequest("B", 1, 0)),
                    null))
        .isInstanceOf(AppException.class)
        .hasMessageContaining("positive timeLimitSeconds");
  }

  /**
   * Verifies that a quiz-level orderIndex clash with an existing standalone question is rejected.
   */
  @Test
  void rejectsQuizLevelOrderIndexClashWithStandaloneQuestion() {
    Quiz quiz = quizWithQuestion(5, 42L);

    assertThatThrownBy(
            () ->
                invokeValidate(
                    quiz,
                    null,
                    5,
                    QuestionType.SINGLE_SELECT,
                    30,
                    List.of(new OptionRequest("A", 0, 5), new OptionRequest("B", 1, 0)),
                    null))
        .isInstanceOf(AppException.class)
        .hasMessageContaining("orderIndex must be unique within the quiz");
  }

  /** Verifies that a quiz-level orderIndex clash with an existing passage is rejected. */
  @Test
  void rejectsQuizLevelOrderIndexClashWithPassage() {
    Quiz quiz = quizWithPassage(5);

    assertThatThrownBy(
            () ->
                invokeValidate(
                    quiz,
                    null,
                    5,
                    QuestionType.SINGLE_SELECT,
                    30,
                    List.of(new OptionRequest("A", 0, 5), new OptionRequest("B", 1, 0)),
                    null))
        .isInstanceOf(AppException.class)
        .hasMessageContaining("orderIndex must be unique within the quiz");
  }

  /** Verifies that updating a question skips its own orderIndex during clash detection. */
  @Test
  void allowsSameOrderIndexWhenUpdatingOwnQuestion() {
    Quiz quiz = quizWithQuestion(5, 42L);

    assertThatCode(
            () ->
                invokeValidate(
                    quiz,
                    null,
                    5,
                    QuestionType.SINGLE_SELECT,
                    30,
                    List.of(new OptionRequest("A", 0, 5), new OptionRequest("B", 1, 0)),
                    42L))
        .doesNotThrowAnyException();
  }

  /**
   * Verifies that {@code PER_SUB_QUESTION} passage sub-questions must define a positive
   * timeLimitSeconds.
   */
  @Test
  void perSubQuestionPassageRequiresPositiveTimeLimit() {
    Passage passage = passageWithSubQuestion(1, null);

    assertThatThrownBy(
            () ->
                invokeValidate(
                    null,
                    passage,
                    2,
                    QuestionType.MULTI_SELECT,
                    0,
                    List.of(new OptionRequest("A", 0, 5), new OptionRequest("B", 1, 0)),
                    null))
        .isInstanceOf(AppException.class)
        .hasMessageContaining(
            "PER_SUB_QUESTION passage sub-questions must define a positive timeLimitSeconds");
  }

  /** Verifies that a passage-level orderIndex clash with an existing sub-question is rejected. */
  @Test
  void rejectsPassageLevelOrderIndexClash() {
    Passage passage = passageWithSubQuestion(3, 99L);

    assertThatThrownBy(
            () ->
                invokeValidate(
                    null,
                    passage,
                    3,
                    QuestionType.MULTI_SELECT,
                    10,
                    List.of(new OptionRequest("A", 0, 5), new OptionRequest("B", 1, 0)),
                    null))
        .isInstanceOf(AppException.class)
        .hasMessageContaining("orderIndex must be unique within the passage");
  }

  /** Verifies that a valid standalone question passes all validation checks. */
  @Test
  void acceptsValidStandaloneQuestion() {
    assertThatCode(
            () ->
                invokeValidate(
                    Quiz.builder().id(1L).title("Q").build(),
                    null,
                    1,
                    QuestionType.MULTI_SELECT,
                    30,
                    List.of(
                        new OptionRequest("A", 0, 5),
                        new OptionRequest("B", 1, 0),
                        new OptionRequest("C", 2, 3)),
                    null))
        .doesNotThrowAnyException();
  }

  /** Verifies that a valid passage sub-question passes all validation checks. */
  @Test
  void acceptsValidPassageSubQuestion() {
    Passage passage = passageWithSubQuestion(1, null);

    assertThatCode(
            () ->
                invokeValidate(
                    null,
                    passage,
                    2,
                    QuestionType.MULTI_SELECT,
                    10,
                    List.of(new OptionRequest("A", 0, 5), new OptionRequest("B", 1, 0)),
                    null))
        .doesNotThrowAnyException();
  }
}
