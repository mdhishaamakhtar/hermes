/**
 * Display formatting. Every number, clock, date, and count a person reads goes
 * through here, so the whole app agrees on how "1,240", "+10", and "0:07" look.
 */

const numberFormat = new Intl.NumberFormat("en-US");
const pluralRules = new Intl.PluralRules("en-US");
const dateFormat = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const thisYearDateTimeFormat = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** "3 quizzes", "1 player". */
export function countLabel(count: number, one: string, other: string): string {
  return `${formatNumber(count)} ${pluralRules.select(count) === "one" ? one : other}`;
}

/** The noun alone, for use beside a number that animates separately. */
export function countNoun(count: number, one: string, other: string): string {
  return pluralRules.select(count) === "one" ? one : other;
}

const ordinalRules = new Intl.PluralRules("en-US", { type: "ordinal" });
const ORDINAL_SUFFIX: Record<string, string> = {
  one: "st",
  two: "nd",
  few: "rd",
  other: "th",
};

/** 1 → "1st", 22 → "22nd", 13 → "13th". */
export function ordinal(value: number): string {
  return `${formatNumber(value)}${ORDINAL_SUFFIX[ordinalRules.select(value)]}`;
}

/** Signed points: "+10", "0", "-5". */
export function formatPoints(points: number): string {
  return points > 0 ? `+${formatNumber(points)}` : formatNumber(points);
}

/** A countdown clock: 67 → "1:07". */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

/** "Sep 26, 2026". Null for a missing timestamp, so callers can omit it. */
export function formatDate(iso: string | null | undefined): string | null {
  return formatTimestamp(iso, dateFormat);
}

/**
 * "Sep 26, 7:05 PM", for things that happen more than once a day, like the
 * same quiz run for three classes. The year is said only when it isn't this
 * one: "Sep 26, 2025, 7:05 PM".
 */
export function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const thisYear = new Date(iso).getFullYear() === new Date().getFullYear();
  return formatTimestamp(
    iso,
    thisYear ? thisYearDateTimeFormat : dateTimeFormat,
  );
}

function formatTimestamp(
  iso: string | null | undefined,
  format: Intl.DateTimeFormat,
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : format.format(date);
}

/** Share of a whole, rounded: 7 of 24 → 29. Zero when there is no whole. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
