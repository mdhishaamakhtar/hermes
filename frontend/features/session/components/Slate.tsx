"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { duration, ease } from "@/lib/motion";
import type { QuestionLifecycle } from "../session-types";

/** From arrival to lift-off: about 0.8s fully down, long enough to read. */
const HOLD_MS = 1300;

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
 * The panel drops in from above and lifts back out the way it came, moving
 * on a transform inside a clipping frame. Both legs share one top speed
 * (about 54px a frame at 60Hz on a 600px stage), so neither feels faster
 * than the other: the drop eases in and settles (`arrive`), the lift eases
 * out of rest and accelerates away (`inOut`). The header, clock and dock
 * stay in view throughout, so nobody loses their place.
 */
const ABOVE = "translateY(-100%)";
const IN_PLACE = "translateY(0%)";

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

  const [gone, setGone] = useState(!holding);
  const down = holding && lifecycle === "DISPLAYED";
  if (gone) return null;

  return (
    <div aria-hidden className="slate-frame">
      <AnimatePresence onExitComplete={() => setGone(true)}>
        {down && (
          <motion.div
            key="slate"
            className="slate"
            initial={reduceMotion ? { opacity: 0 } : { transform: ABOVE }}
            animate={reduceMotion ? { opacity: 1 } : { transform: IN_PLACE }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: duration.enter } }
                : {
                    transform: ABOVE,
                    transition: { duration: duration.lift, ease: ease.inOut },
                  }
            }
            transition={
              reduceMotion
                ? { duration: duration.enter }
                : { duration: duration.lift, ease: ease.arrive }
            }
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
    </div>
  );
}
