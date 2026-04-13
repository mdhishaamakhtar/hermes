"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const easeOutExpo: [number, number, number, number] = [0.22, 1, 0.36, 1];

type LiveParticipantCountProps = {
  count: number;
  /** Shown beside or below the number (uppercased visually via `label` / tracking). */
  caption: string;
  /** Header strip vs lobby hero. */
  size?: "sm" | "lg";
  /** Inline baseline (header) or stacked (lobby card). */
  layout?: "inline" | "stack";
  className?: string;
};

export function LiveParticipantCount({
  count,
  caption,
  size = "sm",
  layout = "inline",
  className = "",
}: LiveParticipantCountProps) {
  const reduceMotion = useReducedMotion();

  const numberClass =
    size === "lg"
      ? "text-4xl font-black tabular-nums leading-none tracking-tight text-accent sm:text-5xl"
      : "text-2xl font-black tabular-nums leading-none text-accent sm:text-3xl";

  const captionClass = "label max-w-[16rem] text-pretty";

  const numberBlock = reduceMotion ? (
    <span className={numberClass}>{count}</span>
  ) : (
    <span className="relative inline-flex min-h-[1em] min-w-[3ch] items-baseline justify-center overflow-hidden tabular-nums">
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={count}
          className={`inline-block ${numberClass}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: easeOutExpo }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
    </span>
  );

  if (layout === "stack") {
    return (
      <div
        className={`flex flex-col items-center gap-2 text-center ${className}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`${count} ${caption}`}
      >
        {numberBlock}
        <span className={captionClass}>{caption}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-baseline gap-2 ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${count} ${caption}`}
    >
      {numberBlock}
      <span className={captionClass}>{caption}</span>
    </div>
  );
}
