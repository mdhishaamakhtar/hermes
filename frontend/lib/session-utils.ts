import { OPTION_META } from "@/lib/session-constants";

export function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
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

export function formatParticipantCount(count: number) {
  return `${count} participant${count === 1 ? "" : "s"}`;
}

export function optionLabel(index: number) {
  return OPTION_META[index % OPTION_META.length];
}
