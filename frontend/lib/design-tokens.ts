/**
 * HERMES DESIGN TOKENS — TypeScript
 *
 * globals.css is the source of truth for colours, durations, easings, and
 * z-index. This file holds only the values TypeScript cannot read from CSS.
 *
 * Before adding anything here, check whether a Tailwind utility or a CSS
 * variable already covers it. Duplicating a value that also lives in
 * globals.css creates drift — the two will disagree, and nothing will catch it.
 */

/* ── Quiz answer option colours ──────────────────────────────────────────── */
/*
 * Option colours live here rather than in CSS because their only consumer is
 * TypeScript: Framer Motion animate props need `rgb` triplets to build dynamic
 * rgba() values, which a CSS variable cannot hand to JS. This is the single
 * definition site — nothing in globals.css restates these.
 */
export const OPTION_META = [
  { letter: "A", color: "#2563eb", rgb: "37,99,235" } /* blue   */,
  { letter: "B", color: "#7c3aed", rgb: "124,58,237" } /* violet */,
  { letter: "C", color: "#d97706", rgb: "217,119,6" } /* amber  */,
  { letter: "D", color: "#e11d48", rgb: "225,29,72" } /* rose   */,
] as const;

export const OPTION_COLORS = OPTION_META.map((m) => m.color);

export type OptionIndex = 0 | 1 | 2 | 3;

/* ── Status colours for dynamic rgba() ───────────────────────────────────── */
/*
 * RGB triplets mirroring the semantic status tokens in globals.css. Needed
 * only where Framer Motion animates a colour with variable alpha.
 *
 * MIRRORS globals.css — if a status colour changes there, change it here too.
 */
export const colorRgb = {
  primary: "37,99,235" /* --palette-blue-600  */,
  success: "34,197,94" /* --palette-green-500 */,
  danger: "239,68,68" /* --palette-red-500   */,
  warning: "217,119,6" /* --palette-amber-600 */,
} as const;

/* ── Motion ───────────────────────────────────────────────────────────────── */
/*
 * TEMPORARY — relocated to lib/motion.ts in the motion-unification stage,
 * where these numbers will be reconciled with the --duration-* tokens in
 * globals.css (they currently disagree: base is 150ms there, 200ms here).
 *
 * The unused presets (fast, slow, spring, springGentle, springSnappy) have
 * been removed; only what is actually referenced remains.
 */
export const transitions = {
  /** Standard UI transitions: panel slides, card entrances */
  base: { duration: 0.2 },
} as const;

/** Standard fade+slide entrance (use with Framer Motion) */
export const enterAnimation = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: transitions.base,
} as const;
