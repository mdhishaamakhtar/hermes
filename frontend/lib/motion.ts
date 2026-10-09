/**
 * HERMES MOTION
 *
 * The vocabulary every Framer animation draws from. globals.css owns the
 * canonical --duration-* values; this file mirrors them because Framer needs
 * numbers. Change one, change the other.
 *
 * Pick an entrance by whether movement tells the truth:
 *   fade      content appearing in place, often over cached data
 *   rise      a surface that genuinely arrived: panel, form, toast
 *   stageCut  the next question cutting in on the live stage
 *
 * Reduced motion is handled once, by <MotionConfig reducedMotion="user"> in
 * Providers: transforms and layout animations drop out, opacity stays.
 */

export const duration = {
  instant: 0.1,
  base: 0.16,
  enter: 0.24,
  sheet: 0.32,
  stage: 0.48,
  /**
   * The slate lifting off the question: the one exit slower than its
   * entrance, because it uncovers what the room is about to read.
   */
  lift: 0.52,
} as const;

type Bezier = [number, number, number, number];

export const ease = {
  /** Expo-out: fast start, gentle settle. Anything arriving. */
  out: [0.16, 1, 0.3, 1] as Bezier,
  /** Symmetric, for moves between two on-screen states. Mirrors --ease-in-out. */
  inOut: [0.65, 0, 0.35, 1] as Bezier,
} as const;

export const spring = {
  /** Values that grow to represent a quantity: response bars. */
  bar: { type: "spring", stiffness: 260, damping: 30 },
  /** Things that move to a new slot: reordered rows, a tab indicator. */
  slot: { type: "spring", stiffness: 480, damping: 38 },
  /** A mark pressed onto a surface: a lock on commit, a tick on reveal. */
  stamp: { type: "spring", duration: 0.32, bounce: 0.3 },
  /** The clock's last five seconds, punching in on every tick. */
  tick: { type: "spring", stiffness: 600, damping: 22 },
} as const;

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: duration.base } },
  transition: { duration: duration.enter, ease: ease.out },
} as const;

export const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4, transition: { duration: duration.base } },
  transition: { duration: duration.enter, ease: ease.out },
} as const;

/**
 * A new question arriving on the stage: a top-down wipe, like a broadcast
 * cut. Clip-path keeps the layout still while the content is revealed.
 */
export const stageCut = {
  initial: { opacity: 0, clipPath: "inset(0% 0% 100% 0%)" },
  animate: { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" },
  exit: { opacity: 0, transition: { duration: duration.base } },
  transition: { duration: duration.stage, ease: ease.out },
} as const;

const STAGGER_STEP = 0.035;
const STAGGER_MAX = 0.28;

/**
 * Delay for the nth item of a list that is being revealed: leaderboards,
 * results. Capped so a long list still lands promptly. Navigational lists
 * the user returns to (events, quizzes) are never staggered.
 */
export function stagger(index: number): number {
  return Math.min(index * STAGGER_STEP, STAGGER_MAX);
}

/** Props for one row of a revealing list: `<motion.li {...revealRow(i)} />`. */
export function revealRow(index: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: duration.enter,
      ease: ease.out,
      delay: stagger(index),
    },
  } as const;
}
