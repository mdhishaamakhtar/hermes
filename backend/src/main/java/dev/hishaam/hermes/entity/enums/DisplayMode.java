package dev.hishaam.hermes.entity.enums;

/**
 * Controls how live answer counts are broadcast during a question.
 *
 * <ul>
 *   <li>{@link #LIVE} — option counts are streamed to participants and the organizer in real time.
 *   <li>{@link #BLIND} — counts are hidden from participants during the TIMED state; revealed to
 *       everyone via {@code ANSWER_REVEAL} after the question is graded.
 *   <li>{@link #CODE_DISPLAY} — like BLIND, but counts are also withheld from the organizer's
 *       analytics view during TIMED state (intended for coding/open-response questions where
 *       showing counts early would give away the answer distribution).
 * </ul>
 */
public enum DisplayMode {
  LIVE,
  BLIND,
  CODE_DISPLAY
}
