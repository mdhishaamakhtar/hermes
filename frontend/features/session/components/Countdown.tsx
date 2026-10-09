"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { formatClock } from "@/lib/format";
import { spring } from "@/lib/motion";
import type { Countdown as CountdownState } from "../session-state";
import type { QuestionLifecycle } from "../session-types";

const NOT_STARTED = "–:––";

function urgency(countdown: CountdownState, running: boolean) {
  if (!running) return "text-subtle";
  if (countdown.left <= 5) return "text-tally";
  if (countdown.left <= 10) return "text-warning";
  return "text-foreground";
}

/**
 * The question clock. Digits tick each second; in the last five they take
 * the tally's red and punch in on every tick, the one place the stage raises its voice.
 */
export function CountdownClock({
  countdown,
  lifecycle,
  className = "",
}: {
  countdown: CountdownState;
  lifecycle: QuestionLifecycle;
  className?: string;
}) {
  const running = lifecycle === "TIMED";
  const final = running && countdown.left > 0 && countdown.left <= 5;
  const label =
    lifecycle === "DISPLAYED"
      ? "Timer not started"
      : running
        ? `${countdown.left} seconds left`
        : "Time's up";

  return (
    <span
      role="timer"
      aria-label={label}
      className={`inline-block font-mono leading-none font-semibold tabular-nums transition-colors duration-(--duration-enter) ${urgency(countdown, running)} ${className}`}
    >
      <motion.span
        key={final ? countdown.left : "steady"}
        className="inline-block"
        initial={final ? { scale: 1.12 } : false}
        animate={{ scale: 1 }}
        transition={spring.tick}
      >
        {lifecycle === "DISPLAYED" ? NOT_STARTED : formatClock(countdown.left)}
      </motion.span>
    </span>
  );
}

/**
 * The draining bar. It runs as a CSS animation on the compositor, restarted
 * only when the server (re)starts the clock, so it stays smooth however busy
 * the page gets. With reduced motion it steps once a second instead.
 */
export function CountdownBar({
  countdown,
  lifecycle,
  className = "",
}: {
  countdown: CountdownState;
  lifecycle: QuestionLifecycle;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const running = lifecycle === "TIMED" && countdown.limit > 0;
  const tone =
    countdown.left <= 5
      ? "bg-tally"
      : countdown.left <= 10
        ? "bg-warning"
        : "bg-accent";

  return (
    <div
      aria-hidden
      className={`h-1 w-full overflow-hidden bg-border ${className}`}
    >
      {running &&
        (reduceMotion ? (
          <div
            className={`h-full origin-left transition-colors ${tone}`}
            style={{ transform: `scaleX(${countdown.left / countdown.limit})` }}
          />
        ) : (
          <div
            key={countdown.run}
            className={`h-full origin-left transition-colors duration-(--duration-enter) ${tone}`}
            style={
              {
                "--drain-from": countdown.startLeft / countdown.limit,
                animation: `drain ${countdown.startLeft}s linear forwards`,
              } as CSSProperties
            }
          />
        ))}
    </div>
  );
}
