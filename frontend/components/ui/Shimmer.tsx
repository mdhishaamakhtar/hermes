/**
 * A single shimmering placeholder block.
 *
 * Replaces the `<div className="h-4 w-24 bg-surface skeleton" />` pattern that
 * appeared ~60 times across the loading states. The `.skeleton` class in
 * globals.css supplies the sweep; this supplies the box.
 *
 * `tone` maps to how prominent the block should read against its backdrop:
 *   strong — stands in for primary text (titles, names, values)
 *   soft   — stands in for secondary text (labels, captions, metadata)
 *
 * On a page background use `surface`; inside an already-surfaced card use
 * `border`, which is one step lighter and stays visible.
 */
type Tone = "strong" | "soft";
type On = "surface" | "border";

const TONE: Record<On, Record<Tone, string>> = {
  surface: { strong: "bg-surface", soft: "bg-surface/50" },
  border: { strong: "bg-border", soft: "bg-border/50" },
};

/**
 * Height of one line of body text.
 *
 * Text with no Tailwind size class inherits the body's 16px / line-height 1.6,
 * giving a 25.6px line box — which no `h-*` step matches (h-6 is 24px). Using
 * `1.6em` makes the placeholder's height *be* the line box rather than a
 * rounded guess, so a row of shimmer reserves exactly the space the text will
 * take. The 2px-per-row error this removes is what makes a list nudge on load.
 */
export const LINE = "h-[1.6em]";

interface ShimmerProps {
  /** Tailwind height class, e.g. "h-4" or {@link LINE}. Match the real line box. */
  h: string;
  /** Tailwind width class, e.g. "w-24" or "w-full". */
  w: string;
  tone?: Tone;
  on?: On;
  /** Extra layout classes (margins, alignment). */
  className?: string;
}

export function Shimmer({
  h,
  w,
  tone = "strong",
  on = "surface",
  className = "",
}: ShimmerProps) {
  return (
    <div className={`${h} ${w} ${TONE[on][tone]} skeleton ${className}`} />
  );
}
