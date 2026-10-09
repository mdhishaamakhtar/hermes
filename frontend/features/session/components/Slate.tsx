"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { duration, ease } from "@/lib/motion";
import type { QuestionLifecycle } from "../session-types";

/** How long the slate holds once it is down, before it rolls back up. */
const HOLD_MS = 1150;

function pad(number: number) {
  return String(number).padStart(2, "0");
}

/** "Q04", or "Q04–06" for an all-together passage. */
export function segmentLabel(first: number, last: number) {
  return last > first ? `Q${pad(first)}–${pad(last)}` : `Q${pad(first)}`;
}

/** What a segment asks of the room, said on its slate. */
export function slateDetail(questions: { questionType: string }[]): string {
  if (questions.length > 1) return `${questions.length} questions, one passage`;
  return questions[0]?.questionType === "MULTI_SELECT"
    ? "Pick every right answer"
    : "One answer";
}

/*
 * A blind, not a cut: it rolls down over the question area, holds while
 * the room reads which segment is next, and rolls back up the way it came.
 * Down is quick and decisive; up is slower and eased at both ends, so the
 * question is uncovered rather than snatched away. The header, clock and
 * dock stay in view the whole time, so nobody loses their place.
 */
const BLIND_UP = "inset(0% 0% 100% 0%)";
const BLIND_DOWN = "inset(0% 0% 0% 0%)";

/**
 * The key-blue slate before a question: which segment this is, how many
 * there are, and what kind of answer it wants. It appears only when a
 * question arrives with its timer not yet running, so it never costs a
 * player answering time, and it lifts the moment the timer starts. Place
 * it in a `relative` box around the question; key it by the question so
 * each new one gets its own slate.
 */
export function QuestionSlate({
  lifecycle,
  first,
  last,
  total,
  detail,
  size = "stage",
}: {
  lifecycle: QuestionLifecycle;
  first: number;
  last: number;
  total: number;
  /** What the question asks for: "One answer", "Pick every right answer". */
  detail: string;
  /** `compact` for small frames: a phone, or the landing demo. */
  size?: "stage" | "compact";
}) {
  const reduceMotion = useReducedMotion();
  // Decided once, on arrival: a slate never comes back mid-question.
  const [holding, setHolding] = useState(lifecycle === "DISPLAYED");

  useEffect(() => {
    if (!holding) return;
    const timer = window.setTimeout(() => setHolding(false), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [holding]);

  const down = holding && lifecycle === "DISPLAYED";

  return (
    <AnimatePresence>
      {down && (
        <motion.div
          key="slate"
          aria-hidden
          className="slate"
          initial={reduceMotion ? { opacity: 0 } : { clipPath: BLIND_UP }}
          animate={reduceMotion ? { opacity: 1 } : { clipPath: BLIND_DOWN }}
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: duration.enter } }
              : {
                  clipPath: BLIND_UP,
                  transition: { duration: duration.lift, ease: ease.inOut },
                }
          }
          transition={{ duration: duration.sheet, ease: ease.out }}
        >
          <p
            className={`display display-tight leading-[0.82] ${
              size === "stage"
                ? "text-[clamp(4.5rem,11vw,8.5rem)]"
                : "text-[clamp(3.75rem,17vw,5.5rem)]"
            }`}
          >
            {segmentLabel(first, last)}
          </p>
          <p
            className={`mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono font-medium text-on-primary-muted uppercase ${
              size === "stage" ? "text-base sm:text-lg" : "text-sm"
            }`}
          >
            <span>of {pad(total)}</span>
            <span aria-hidden className="text-on-primary-muted">
              /
            </span>
            <span>{detail}</span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
