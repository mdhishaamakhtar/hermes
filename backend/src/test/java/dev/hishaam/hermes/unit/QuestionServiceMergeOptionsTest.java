package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.dto.OptionRequest;
import dev.hishaam.hermes.entity.AnswerOption;
import dev.hishaam.hermes.entity.Question;
import dev.hishaam.hermes.service.QuestionService;
import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link QuestionService#mergeOptions}.
 *
 * <p>This class verifies the option-merging logic that preserves database IDs when options are
 * updated in-place, adds new options for previously unseen order-index values, and removes options
 * that no longer appear in the request. No database, Redis, or Spring context is involved.
 */
class QuestionServiceMergeOptionsTest {

  private static Method mergeMethod;

  @BeforeAll
  static void resolveMethod() throws Exception {
    mergeMethod =
        QuestionService.class.getDeclaredMethod("mergeOptions", Question.class, List.class);
    mergeMethod.setAccessible(true);
  }

  private static void invokeMerge(Question question, List<OptionRequest> requests) {
    try {
      QuestionService service = new QuestionService(null, null, null);
      mergeMethod.invoke(service, question, requests);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  private static Question questionWithOptions(AnswerOption... options) {
    Question q = Question.builder().id(1L).text("Q").build();
    q.getOptions().addAll(List.of(options));
    return q;
  }

  /**
   * Verifies that options matching an existing order-index are updated in-place, preserving their
   * database ID while changing text and point-value.
   */
  @Test
  void updatesExistingOptionsInPlacePreservingIds() {
    AnswerOption existing =
        AnswerOption.builder().id(10L).orderIndex(0).text("Old text").pointValue(5).build();
    Question question = questionWithOptions(existing);

    invokeMerge(question, List.of(new OptionRequest("New text", 0, 8)));

    assertThat(question.getOptions()).hasSize(1);
    assertThat(question.getOptions().getFirst().getId()).isEqualTo(10L);
    assertThat(question.getOptions().getFirst().getText()).isEqualTo("New text");
    assertThat(question.getOptions().getFirst().getPointValue()).isEqualTo(8);
  }

  /** Verifies that new options with previously unseen order-indexes are added to the question. */
  @Test
  void addsNewOptionsForUnseenOrderIndexes() {
    AnswerOption existing = AnswerOption.builder().id(10L).orderIndex(0).text("Existing").build();
    Question question = questionWithOptions(existing);

    invokeMerge(
        question, List.of(new OptionRequest("Existing", 0, 5), new OptionRequest("New", 1, 8)));

    assertThat(question.getOptions()).hasSize(2);
    assertThat(question.getOptions().stream().map(AnswerOption::getText))
        .containsExactlyInAnyOrder("Existing", "New");
  }

  /** Verifies that options not present in the request are removed from the question. */
  @Test
  void removesOptionsNotInTheRequest() {
    AnswerOption keep = AnswerOption.builder().id(10L).orderIndex(0).text("Keep").build();
    AnswerOption drop = AnswerOption.builder().id(20L).orderIndex(1).text("Drop").build();
    Question question = questionWithOptions(keep, drop);

    invokeMerge(question, List.of(new OptionRequest("Keep", 0, 5)));

    assertThat(question.getOptions()).hasSize(1);
    assertThat(question.getOptions().getFirst().getText()).isEqualTo("Keep");
  }

  /**
   * Verifies that when a complete replacement (update, add, remove) happens in a single merge call,
   * all mutations are applied correctly.
   */
  @Test
  void handlesUpdateAddAndRemoveTogether() {
    AnswerOption old =
        AnswerOption.builder().id(1L).orderIndex(0).text("Updated").pointValue(3).build();
    AnswerOption removed = AnswerOption.builder().id(2L).orderIndex(1).text("Removed").build();
    Question question = questionWithOptions(old, removed);

    invokeMerge(
        question, List.of(new OptionRequest("Updated", 0, 10), new OptionRequest("Added", 2, 5)));

    assertThat(question.getOptions()).hasSize(2);
    List<AnswerOption> options = question.getOptions();
    assertThat(options.stream().map(AnswerOption::getText))
        .containsExactlyInAnyOrder("Updated", "Added");
    AnswerOption updated = options.stream().filter(o -> o.getId() == 1L).findFirst().orElseThrow();
    assertThat(updated.getText()).isEqualTo("Updated");
    assertThat(updated.getPointValue()).isEqualTo(10);
  }
}
