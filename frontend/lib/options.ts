/**
 * Answer-option identity. Each option position owns a letter and one of the
 * four option colours from globals.css; a fifth option wraps back to blue
 * but keeps its own letter, so the letter is always the source of truth.
 */

const OPTION_COLORS = [
  "var(--color-option-a)",
  "var(--color-option-b)",
  "var(--color-option-c)",
  "var(--color-option-d)",
] as const;

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function optionColor(index: number): string {
  return OPTION_COLORS[index % OPTION_COLORS.length];
}

/** Server option lists arrive unordered; everything renders them by position. */
export function byOrderIndex<T extends { orderIndex: number }>(
  items: T[],
): T[] {
  return items.toSorted((a, b) => a.orderIndex - b.orderIndex);
}
