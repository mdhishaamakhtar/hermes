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
 *   stageCut  the next question settling onto the live stage, under its
 *             slate; the slate is the authored moment, so this stays quiet
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
  /**
   * A large surface travelling in: a gentle start, a top speed reached a
   * third of the way, then a long settle. Unlike `out`, it does not cover
   * half the distance in the first few frames, which on a tall surface
   * reads as a jump-cut followed by a crawl (176px in the first 60Hz frame
   * of a 600px slate, against 1.5px for this curve).
   */
  arrive: [0.4, 0, 0.2, 1] as Bezier,
} as const;

export const spring = {
  /** Values that grow to represent a quantity: response bars. */
  bar: { type: "spring", stiffness: 260, damping: 30 },
  /**
   * Things that move to a new slot: reordered rows, a tab indicator.
   * Critically damped (2 * sqrt(480) ~ 44): nobody flicked these, so they
   * settle without overshooting the slot.
   */
  slot: { type: "spring", stiffness: 480, damping: 44 },
  /** A mark pressed onto a surface: a lock on commit, a tick on reveal. */
  stamp: { type: "spring", duration: 0.32, bounce: 0.3 },
  /**
   * The clock's last five seconds, punching in on every tick: one small
   * overshoot, then still. A lower damping ratio wobbled the digits.
   */
  tick: { type: "spring", duration: 0.3, bounce: 0.2 },
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
 * A new question arriving on the stage. It usually lands under the slate,
 * which carries the moment, so this is a short settle on the compositor
 * (opacity and a transform, never a per-frame repaint) that still reads as
 * an arrival when a question comes in with no slate, after a reconnect.
 */
export const stageCut = {
  initial: { opacity: 0, transform: "translateY(10px)" },
  animate: { opacity: 1, transform: "translateY(0px)" },
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
