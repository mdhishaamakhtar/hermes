package dev.hishaam.hermes.entity.enums;

/**
 * Determines how many answer options a participant may select for a question.
 *
 * <ul>
 *   <li>{@link #SINGLE_SELECT} — exactly one option may be chosen; submitting more than one is
 *       rejected at the service layer.
 *   <li>{@link #MULTI_SELECT} — one or more options may be chosen; partial credit is possible when
 *       individual options carry different point values.
 * </ul>
 */
public enum QuestionType {
  SINGLE_SELECT,
  MULTI_SELECT
}
