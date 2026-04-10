import { OPTION_META } from "@/lib/session-constants";

export function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

/** Shown when the question is visible but the host has not started the timer yet. */
export const TIMER_NOT_STARTED_DISPLAY = "\u2014:\u2014";

export type SessionCountdownLifecycle =
  | "DISPLAYED"
  | "TIMED"
  | "FROZEN"
  | "REVIEWING";

/**
 * Formats the live countdown, or a neutral placeholder before TIMER_START.
 */
export function formatCountdownClock(
  timeLeft: number | null,
  lifecycle: SessionCountdownLifecycle,
): string {
  if (lifecycle === "DISPLAYED" || timeLeft === null) {
    return TIMER_NOT_STARTED_DISPLAY;
  }
  return formatTime(timeLeft);
}

export function normalizeCounts(
  counts: Record<string, number> | Record<number, number>,
) {
  return Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [Number(key), Number(value)]),
  ) as Record<number, number>;
}

export function normalizePoints(points: Record<string | number, number>) {
  return Object.fromEntries(
    Object.entries(points).map(([key, value]) => [Number(key), Number(value)]),
  ) as Record<number, number>;
}

/** Coerce WebSocket / JSON ids (sometimes strings) to numbers. */
export function normalizeIdList(ids: readonly unknown[]): number[] {
  return ids.map((id) => Number(id));
}

export function formatParticipantCount(count: number) {
  return `${count} participant${count === 1 ? "" : "s"}`;
}

/** Noun only (no leading number), for use next to an animated count. */
export function formatParticipantCountPhrase(count: number) {
  return count === 1 ? "participant" : "participants";
}

export function optionLabel(index: number) {
  return OPTION_META[index % OPTION_META.length];
}
