/** Canonical option colour definitions shared between host and play pages. */
export const OPTION_META = [
  { letter: "A", color: "#2563EB", rgb: "37,99,235" },
  { letter: "B", color: "#7C3AED", rgb: "124,58,237" },
  { letter: "C", color: "#D97706", rgb: "217,119,6" },
  { letter: "D", color: "#E11D48", rgb: "225,29,72" },
] as const;

/** Plain colour array for contexts that only need the hex value. */
export const OPTION_COLORS = OPTION_META.map((m) => m.color);
