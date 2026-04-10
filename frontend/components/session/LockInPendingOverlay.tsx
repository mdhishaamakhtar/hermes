"use client";

import { motion, useReducedMotion } from "framer-motion";

export type LockInPendingTone = "primary" | "surface";

const GRADIENT: Record<LockInPendingTone, string> = {
  primary:
    "linear-gradient(90deg, transparent 0%, transparent 30%, rgba(255, 255, 255, 0.26) 50%, transparent 70%, transparent 100%)",
  surface:
    "linear-gradient(90deg, transparent 0%, transparent 30%, color-mix(in srgb, var(--color-accent) 52%, transparent) 50%, transparent 70%, transparent 100%)",
};

/**
 * Seamless left-to-right sweep while lock-in is pending (two identical stripes,
 * linear infinite — no ease bounce or alternate direction).
 */
export function LockInPendingOverlay({ tone }: { tone: LockInPendingTone }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return null;
  }

  const backgroundImage = GRADIENT[tone];

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <motion.div
        aria-hidden
        className="absolute inset-y-0 left-0 flex w-[200%]"
        animate={{ x: ["-50%", "0%"] }}
        transition={{
          duration: 1.35,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <div
          className="h-full w-1/2 shrink-0 bg-no-repeat"
          style={{ backgroundImage, backgroundSize: "100% 100%" }}
        />
        <div
          className="h-full w-1/2 shrink-0 bg-no-repeat"
          style={{ backgroundImage, backgroundSize: "100% 100%" }}
        />
      </motion.div>
    </div>
  );
}
