package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import java.util.List;

/**
 * What the session is currently sitting on: either a single standalone question, or an
 * ENTIRE_PASSAGE block whose sub-questions are displayed, timed, frozen and graded together.
 *
 * <p>Resolved from Redis state by {@link SessionEngine#resolveCurrentTarget} so that the timer,
 * expiry and session-end paths can share one code path instead of each branching on whether a
 * passage is active.
 */
sealed interface CurrentTarget {

  /** Questions whose answers this target owns — frozen and graded as a unit. */
  List<Long> questionIds();

  /** Configured countdown in seconds, or null if the target has no time limit set. */
  Integer timeLimitSeconds();

  record Question(QuizSnapshot.QuestionSnapshot question) implements CurrentTarget {
    @Override
    public List<Long> questionIds() {
      return List.of(question.id());
    }

    @Override
    public Integer timeLimitSeconds() {
      return question.timeLimitSeconds();
    }
  }

  record Passage(QuizSnapshot.PassageSnapshot passage) implements CurrentTarget {
    @Override
    public List<Long> questionIds() {
      return passage.subQuestionIds();
    }

    @Override
    public Integer timeLimitSeconds() {
      return passage.timeLimitSeconds();
    }
  }
}
