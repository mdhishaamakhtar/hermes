/**
 * HERMES DESIGN TOKENS — JavaScript/TypeScript
 *
 * Single source of truth for values that must be used in JS/TSX inline styles
 * or dynamic computations. For static Tailwind usage, use the CSS classes
 * generated from globals.css (@theme tokens).
 *
 * These values must stay in sync with globals.css.
 *
 * Rule: prefer Tailwind utility classes over these tokens wherever possible.
 * Use these only when dynamic inline styles are unavoidable (e.g. Framer
 * Motion animate props, canvas drawing, dynamic rgba() values).
 */

/* ── Colours ──────────────────────────────────────────────────────────────── */

export const colors = {
  background: "#0a0a0f",
  surface: "#0f1117",
  border: "#1a1f2e",
  overlay: "#252b3b",

  foreground: "#f8fafc",
  muted: "#94a3b8",
  mutedDark: "#4b5563",

  primary: "#2563eb",
  primaryHover: "#1d4ed8",

  accent: "#38bdf8",
  accentHover: "#7dd3fc",

  success: "#22c55e",
  warning: "#d97706",
  warningHover: "#b45309",
  danger: "#ef4444",
} as const;

/* ── Quiz answer option colours ──────────────────────────────────────────── */
/*
 * Also available as CSS variables: --option-a-color, --option-b-color, etc.
 * The `rgb` string is for constructing rgba() values in inline styles.
 */
export const OPTION_META = [
  { letter: "A", color: "#2563eb", rgb: "37,99,235" } /* blue   */,
  { letter: "B", color: "#7c3aed", rgb: "124,58,237" } /* violet */,
  { letter: "C", color: "#d97706", rgb: "217,119,6" } /* amber  */,
  { letter: "D", color: "#e11d48", rgb: "225,29,72" } /* rose   */,
] as const;

/** RGB triplets for colours that need rgba() in JS (e.g. Framer Motion animate props) */
export const colorRgb = {
  primary: "37,99,235",
  success: "34,197,94",
  danger: "239,68,68",
  warning: "217,119,6",
} as const;

export const OPTION_COLORS = OPTION_META.map((m) => m.color);

export type OptionIndex = 0 | 1 | 2 | 3;

/* ── Motion ───────────────────────────────────────────────────────────────── */
/*
 * Framer Motion transition presets. Use these for consistent animation feel
 * across all components.
 */
export const transitions = {
  /** Quick micro-interactions: button presses, toggles */
  fast: { duration: 0.1 },

  /** Standard UI transitions: panel slides, card entrances */
  base: { duration: 0.2 },

  /** Slower, deliberate transitions: page-level state changes */
  slow: { duration: 0.3 },

  /** Spring for layout animations: leaderboard reordering */
  spring: { type: "spring" as const, stiffness: 200, damping: 25 },

  /** Spring for counter animations */
  springGentle: { type: "spring" as const, stiffness: 120, damping: 20 },

  /** Fast spring for bar/graph animations */
  springSnappy: { type: "spring" as const, stiffness: 300, damping: 32 },
} as const;

/** Standard fade+slide entrance (use with Framer Motion) */
export const enterAnimation = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: transitions.base,
} as const;

/* ── Z-index ──────────────────────────────────────────────────────────────── */
/*
 * Keep in sync with :root z-index tokens in globals.css.
 * Use these when z-index must be set via inline style or JS.
 */
export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
  tooltip: 600,
} as const;

/* ── Breakpoints ──────────────────────────────────────────────────────────── */
/*
 * Tailwind's default breakpoints, typed for use in JS (e.g. resize observers).
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;
