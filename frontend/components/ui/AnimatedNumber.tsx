"use client";

import { useEffect } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { formatNumber } from "@/lib/format";
import { duration, ease } from "@/lib/motion";

/**
 * A live count that rolls to its next value: players joining, answers
 * arriving. Each change slides the new figure up through a clipped window,
 * so a jump from 11 to 12 reads as arrival rather than a flicker.
 */
export function RollingNumber({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={{ duration: duration.enter, ease: ease.out }}
          className={`tabular-nums ${className}`}
        >
          {formatNumber(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * A total earned over the session, counted up from zero once, when it first
 * lands. Screen readers get the final figure; the tally itself is visual.
 */
export function CountUp({
  value,
  seconds = 1.1,
  className = "",
}: {
  value: number;
  seconds?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const current = useMotionValue(0);
  const text = useTransform(current, (latest) =>
    formatNumber(Math.round(latest)),
  );

  useEffect(() => {
    if (reduceMotion) {
      current.set(value);
      return;
    }
    const controls = animate(current, value, {
      duration: seconds,
      ease: ease.out,
    });
    return () => controls.stop();
  }, [current, reduceMotion, seconds, value]);

  return (
    <span className={className}>
      <span className="sr-only">{formatNumber(value)}</span>
      <motion.span aria-hidden className="tabular-nums">
        {text}
      </motion.span>
    </span>
  );
}
