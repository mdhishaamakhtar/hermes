package dev.hishaam.hermes.entity.enums;

/**
 * Host-driven lifecycle of the current question (or ENTIRE_PASSAGE block) in an ACTIVE session:
 * DISPLAYED (shown, timer not started) → TIMED (accepting answers) → REVIEWING (answers frozen and
 * graded; host may advance). Stored as the session's question_state key in Redis.
 */
public enum QuestionLifecycleState {
  DISPLAYED,
  TIMED,
  REVIEWING
}
