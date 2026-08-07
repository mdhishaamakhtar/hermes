/**
 * HERMES MOTION
 *
 * The single source for animation in TSX. Every Framer Motion transition
 * should come from here — if a component writes `duration: 0.15` inline, that
 * number has no name, no meaning, and nothing keeping it equal to its
 * neighbours.
 *
 * ── Relationship to globals.css ──────────────────────────────────────────
 * globals.css owns the canonical values as --duration-* and --ease-*. This
 * file MIRRORS them, because Framer needs numbers in JS and cannot read a CSS
 * variable. The two must stay equal; this is the only place in TSX where a
 * raw motion number is allowed to appear.
 *
 * ── Entrance philosophy ─────────────────────────────────────────────────
 * There is exactly one rule for how things enter, and it turns on whether
 * movement is telling the truth:
 *
 *   `fade`  — content arriving in place, over data that may already be
 *             cached. It has not moved, so it must not appear to. Sliding
 *             here reads as a flicker on every revisit.
 *
 *   `rise`  — a surface genuinely new to the screen: modal, drawer,
 *             dropdown, the next question. It really did arrive, so a short
 *             travel earns its place.
 *
 * Use `fade` unless you can say what moved.
 */

/* ── Durations (seconds) — mirror --duration-* in globals.css ───────────── */

export const duration = {
  /** 50ms — immediate feedback, hover border changes */
  instant: 0.05,
  /** 100ms — micro-interactions, and exits: leaving is quicker than arriving */
  fast: 0.1,
  /** 150ms — standard UI transitions (most common) */
  base: 0.15,
  /** 200ms — elements arriving on screen */
  enter: 0.2,
  /** 250ms — page-level entrances, complex state changes */
  slow: 0.25,
} as const;

/* ── Easings — mirror --ease-* in globals.css ───────────────────────────── */

/**
 * Cubic-bezier control points. Typed as a 4-tuple because Framer rejects a
 * plain number[].
 */
type Bezier = [number, number, number, number];

export const ease = {
  /** expo-out: fast start, gentle settle. For anything entering. */
  out: [0.16, 1, 0.3, 1] as Bezier,
  /** Symmetric. For anything moving between two on-screen states. */
  inOut: [0.4, 0, 0.2, 1] as Bezier,
} as const;

/* ── Springs ────────────────────────────────────────────────────────────── */

/**
 * One spring, for values that grow to represent a quantity: option response
 * bars, score meters, count-ups. Physical overshoot suits a filling bar in a
 * way a fixed duration does not.
 *
 * Previously three near-identical springs (240/30, 300/32, 260/28) were
 * hand-written across the question cards. The differences were accidental and
 * below the perceptual threshold.
 */
export const spring = {
  bar: { type: "spring", stiffness: 300, damping: 32 },
} as const;

/* ── Continuous motion ──────────────────────────────────────────────────── */
/*
 * Neither of these is a UI transition, which is why neither uses the duration
 * scale above — their timing is set by something outside the interface.
 */

/**
 * The countdown bar. Its duration is the 1Hz tick interval, not a transition,
 * and it must be linear: easing within each second would make a steadily
 * draining bar visibly stutter.
 */
export const timerTick = { duration: 1, ease: "linear" } as const;

/**
 * The lock-in sweep, looping while a submission is in flight. Deliberately
 * slower than any transition so it reads as "still working" rather than as
 * something that finished.
 */
export const pendingSweep = {
  duration: 1.35,
  repeat: Infinity,
  ease: "linear",
} as const;

/* ── Entrances ──────────────────────────────────────────────────────────── */

/**
 * Content appearing in place. No translate — see the entrance philosophy
 * above. This is the default; reach for `rise` only when something moved.
 */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: duration.base, ease: ease.out },
} as const;

/**
 * A surface genuinely arriving on screen: modal, drawer, dropdown, the next
 * question. One travel distance, so panels never disagree about how far
 * "up" is.
 */
export const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: duration.enter, ease: ease.out },
} as const;

/*
 * `rise` has a CSS twin, the `page-enter` utility in globals.css — same 8px
 * travel, duration, and easing. Server components use that one; it costs no
 * JS and paints before hydration. Use `rise` in client components already
 * running Framer, or when AnimatePresence needs to animate the exit too.
 */

/** `rise` inverted, for surfaces anchored below their trigger. */
export const riseFromBelow = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: duration.enter, ease: ease.out },
} as const;

/* ── Stagger ────────────────────────────────────────────────────────────── */

const STAGGER_STEP = 0.03;
const STAGGER_MAX = 0.24;

/**
 * Per-item delay for a list that is *revealing* — final leaderboards, results,
 * review. The cascade is the point there: it walks the eye down the ranking.
 *
 * Do NOT stagger navigational lists (dashboard, events, quizzes). Those show
 * data the user is returning to, and a cascade on every visit reads as lag.
 *
 * Capped so a long list still finishes promptly; past ~8 items the delay stops
 * growing rather than making the last row wait a second to appear.
 */
export function stagger(index: number): number {
  return Math.min(index * STAGGER_STEP, STAGGER_MAX);
}

/**
 * Props for one row of a revealing list — leaderboards, results, review.
 * Spread onto the row: `<LeaderboardRow {...revealRow(index)} />`.
 *
 * Exists because all four leaderboards (host live, host ended, play live,
 * review) previously hand-wrote the same three lines with slightly different
 * numbers, and the host's live list drifted to a horizontal slide for no
 * reason anyone recorded.
 */
export function revealRow(index: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: duration.base,
      ease: ease.out,
      delay: stagger(index),
    },
  } as const;
}
