package dev.hishaam.hermes.entity.enums;

/**
 * Determines how the countdown timer applies to a passage and its sub-questions.
 *
 * <ul>
 *   <li>{@link #PER_SUB_QUESTION} — each sub-question is displayed and timed individually, exactly
 *       like a standalone question. The passage text appears as context alongside each
 *       sub-question.
 *   <li>{@link #ENTIRE_PASSAGE} — all sub-questions are displayed simultaneously under one shared
 *       timer. A single {@code PASSAGE_DISPLAYED} event replaces the per-question {@code
 *       QUESTION_DISPLAYED} events.
 * </ul>
 */
public enum PassageTimerMode {
  PER_SUB_QUESTION,
  ENTIRE_PASSAGE
}
