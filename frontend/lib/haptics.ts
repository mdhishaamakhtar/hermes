/**
 * HERMES HAPTICS
 *
 * A player's phone answers back under the thumb at the three moments that
 * matter: picking an answer, committing to it, and learning how it went.
 * Nothing else buzzes; feedback everywhere is feedback nowhere.
 *
 * Fire these on the causal event, in the same frame as the visual change.
 * Android browsers vibrate; iOS Safari has no Vibration API, so there these
 * are silent no-ops and the visual carries the moment alone.
 */

function buzz(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Blocked before a user gesture, or by policy. Haptics are a bonus.
  }
}

export const haptics = {
  /** An answer tile picked or unpicked: the lightest tick. */
  select: () => buzz(6),
  /** Answers locked in: one firm press. */
  commit: () => buzz(14),
  /** A verdict landing: a double pulse for points, one dull thud for none. */
  result: (scored: boolean) => buzz(scored ? [12, 60, 18] : 32),
} as const;
