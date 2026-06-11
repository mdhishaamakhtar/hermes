package dev.hishaam.hermes.entity;

/**
 * Lifecycle state of a {@link QuizSession}.
 *
 * <ul>
 *   <li>{@link #LOBBY} — session created; participants may join via join code; no questions shown.
 *   <li>{@link #ACTIVE} — quiz in progress; questions are advancing; answers are accepted.
 *   <li>{@link #ENDED} — quiz finished; results are available; session is read-only.
 * </ul>
 */
public enum SessionStatus {
  LOBBY,
  ACTIVE,
  ENDED
}
