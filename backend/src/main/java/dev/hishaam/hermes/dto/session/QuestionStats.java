package dev.hishaam.hermes.dto.session;

import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import java.util.List;
import java.util.Map;

/**
 * Live tallies and, once known, the answer key for the question on screen. Sent in the host-sync
 * and rejoin responses so a reconnecting client can rebuild what the event stream already told it.
 */
public record QuestionStats(
    Map<Long, Long> counts,
    long totalAnswered,
    long totalLockedIn,
    long totalParticipants,
    List<Long> correctOptionIds,
    Map<Long, Integer> optionPoints,
    boolean revealed,
    boolean reviewed) {

  /** The organiser's view: every tally and the answer key, whatever the lifecycle state. */
  public static QuestionStats forHost(
      QuizSnapshot.QuestionSnapshot question, AnswerStats live, QuestionLifecycleState lifecycle) {
    boolean reviewed = lifecycle == QuestionLifecycleState.REVIEWING;
    return new QuestionStats(
        live.optionCounts(),
        live.totalAnswered(),
        live.totalLockedIn(),
        live.totalParticipants(),
        question.correctOptionIds(),
        question.optionPoints(),
        reviewed && question.effectiveDisplayMode() != DisplayMode.LIVE,
        reviewed);
  }

  /**
   * A player's view, limited to what the event stream would have shown them by now. The answer key
   * stays out until the question is reviewed, since a rejoin can be requested at any moment during
   * the countdown; tallies follow the display mode, as {@code ANSWER_UPDATE} does.
   */
  public static QuestionStats forParticipant(
      QuizSnapshot.QuestionSnapshot question, AnswerStats live, QuestionLifecycleState lifecycle) {
    if (lifecycle == QuestionLifecycleState.REVIEWING) {
      return forHost(question, live, lifecycle);
    }
    DisplayMode mode = question.effectiveDisplayMode();
    boolean hideTotals = mode == DisplayMode.CODE_DISPLAY;
    return new QuestionStats(
        mode == DisplayMode.LIVE ? live.optionCounts() : Map.of(),
        hideTotals ? 0 : live.totalAnswered(),
        hideTotals ? 0 : live.totalLockedIn(),
        live.totalParticipants(),
        List.of(),
        Map.of(),
        false,
        false);
  }
}
