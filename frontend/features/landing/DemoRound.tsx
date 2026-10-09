"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AnswerOption } from "@/features/session/components/AnswerOption";
import {
  CountdownBar,
  CountdownClock,
} from "@/features/session/components/Countdown";
import { Leaderboard } from "@/features/session/components/Leaderboard";
import { StationClock, Tally } from "@/features/session/components/OnAir";
import { QuestionSlate } from "@/features/session/components/Slate";
import type { Countdown } from "@/features/session/session-state";
import type {
  LeaderboardEntry,
  QuestionLifecycle,
} from "@/features/session/session-types";
import { formatNumber } from "@/lib/format";
import { stageCut } from "@/lib/motion";

/*
 * Sample data, labelled as such on the page. The round is played by the
 * same components the live stage uses, so what a visitor watches here is
 * what their room will see.
 */
const ROUNDS = [
  {
    text: "Which planet has the shortest day?",
    options: ["Mercury", "Jupiter", "Earth", "Venus"],
    correct: 1,
    weights: [3, 9, 4, 2],
  },
  {
    text: "How many strings does a standard violin have?",
    options: ["Four", "Five", "Six", "Seven"],
    correct: 0,
    weights: [10, 4, 3, 1],
  },
  {
    text: "Which element has the chemical symbol Fe?",
    options: ["Fluorine", "Iron", "Lead", "Francium"],
    correct: 1,
    weights: [3, 11, 1, 3],
  },
];
const PLAYERS = ["Priya", "Marcus", "Wen", "Adaeze", "Sofia", "Luca"];
const ROOM = 24;
const TIMER = 8;
const PAUSE_MS = { displayed: 1700, frozen: 800, reviewing: 3600 };

interface DemoState {
  round: number;
  lifecycle: QuestionLifecycle;
  countdown: Countdown;
  counts: number[];
  scores: number[];
}

type DemoAction =
  | { type: "START_TIMER" }
  | { type: "TICK" }
  | { type: "ANSWER"; option: number }
  | { type: "FREEZE" }
  | { type: "REVEAL"; gains: number[] }
  | { type: "NEXT" };

const INITIAL: DemoState = {
  round: 0,
  lifecycle: "DISPLAYED",
  countdown: { limit: TIMER, left: TIMER, startLeft: TIMER, run: 0 },
  counts: [0, 0, 0, 0],
  scores: [40, 30, 30, 20, 10, 0],
};

/** The frame a visitor sees with reduced motion: first question, revealed. */
const STILL: DemoState = {
  ...INITIAL,
  lifecycle: "REVIEWING",
  countdown: { ...INITIAL.countdown, left: 0 },
  counts: [4, 12, 5, 2],
};

function reducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "START_TIMER":
      return {
        ...state,
        lifecycle: "TIMED",
        countdown: {
          limit: TIMER,
          left: TIMER,
          startLeft: TIMER,
          run: state.countdown.run + 1,
        },
      };
    case "TICK":
      return {
        ...state,
        countdown: {
          ...state.countdown,
          left: Math.max(0, state.countdown.left - 1),
        },
      };
    case "ANSWER": {
      const answered = state.counts.reduce((sum, count) => sum + count, 0);
      if (answered >= ROOM - 1) return state;
      const counts = [...state.counts];
      counts[action.option] += 1;
      return { ...state, counts };
    }
    case "FREEZE":
      return {
        ...state,
        lifecycle: "FROZEN",
        countdown: { ...state.countdown, left: 0 },
      };
    case "REVEAL":
      return {
        ...state,
        lifecycle: "REVIEWING",
        scores: state.scores.map((score, i) => score + action.gains[i]),
      };
    case "NEXT":
      return {
        ...state,
        round: (state.round + 1) % ROUNDS.length,
        lifecycle: "DISPLAYED",
        counts: [0, 0, 0, 0],
        countdown: { ...state.countdown, left: TIMER },
        // Loop the standings back before they drift too far apart.
        scores:
          state.round === ROUNDS.length - 1 ? INITIAL.scores : state.scores,
      };
  }
}

function weightedPick(weights: number[]) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return weights.length - 1;
}

/** Plays only while on screen and while the tab is visible. */
function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let onScreen = false;
    const update = () =>
      setInView(onScreen && document.visibilityState === "visible");
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return [ref, inView] as const;
}

export function DemoRound() {
  const reduceMotion = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [live, dispatch] = useReducer(reducer, INITIAL);
  const playing = inView && !reduceMotion;
  const state = reduceMotion ? STILL : live;
  const round = ROUNDS[state.round];
  const timeUp = live.lifecycle === "TIMED" && live.countdown.left === 0;

  useEffect(() => {
    if (!playing) return;
    const timers: number[] = [];
    const later = (ms: number, run: () => void) =>
      timers.push(window.setTimeout(run, ms));

    if (live.lifecycle === "DISPLAYED") {
      later(PAUSE_MS.displayed, () => dispatch({ type: "START_TIMER" }));
    } else if (live.lifecycle === "TIMED") {
      // Freeze off the clock itself, so a pause mid-question resumes cleanly.
      if (timeUp) {
        later(250, () => dispatch({ type: "FREEZE" }));
      } else {
        const current = ROUNDS[live.round];
        const tick = window.setInterval(() => dispatch({ type: "TICK" }), 1000);
        const answer = window.setInterval(
          () =>
            dispatch({ type: "ANSWER", option: weightedPick(current.weights) }),
          260,
        );
        return () => {
          window.clearInterval(tick);
          window.clearInterval(answer);
        };
      }
    } else if (live.lifecycle === "FROZEN") {
      later(PAUSE_MS.frozen, () =>
        dispatch({
          type: "REVEAL",
          gains: PLAYERS.map(() =>
            Math.random() < 0.6 ? 10 + Math.round(Math.random() * 6) * 5 : 0,
          ),
        }),
      );
    } else {
      later(PAUSE_MS.reviewing, () => dispatch({ type: "NEXT" }));
    }
    return () => timers.forEach(window.clearTimeout);
  }, [playing, live.lifecycle, live.round, timeUp]);

  const answered = state.counts.reduce((sum, count) => sum + count, 0);
  const reviewed = state.lifecycle === "REVIEWING";
  const standings: LeaderboardEntry[] = PLAYERS.map((name, index) => ({
    participantId: index,
    displayName: name,
    score: state.scores[index],
    rank: 0,
  }))
    .toSorted((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return (
    <figure ref={ref} className="w-full">
      <figcaption className="sr-only">
        An example round: a question on the big screen, answers arriving from
        players&apos; phones, the correct answer revealed, and the standings
        updating.
      </figcaption>
      <div aria-hidden className="border border-border-strong bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 sm:px-5">
          <Tally state="on-air" />
          <span className="flex items-center gap-4 text-sm text-muted">
            <StationClock className="hidden sm:inline" />
            <span>
              Code <span className="font-mono text-foreground">K7Q2XM</span>
            </span>
          </span>
        </div>
        <CountdownBar countdown={state.countdown} lifecycle={state.lifecycle} />
        <div className="px-4 pt-4 pb-5 sm:px-6 sm:pt-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted">
              <span className="font-mono text-foreground">
                Question {state.round + 1}
              </span>{" "}
              of {ROUNDS.length}
            </p>
            <CountdownClock
              countdown={state.countdown}
              lifecycle={state.lifecycle}
              className="text-2xl"
            />
          </div>
          <div className="relative mt-3">
            <QuestionSlate
              key={state.round}
              size="compact"
              lifecycle={state.lifecycle}
              first={state.round + 1}
              last={state.round + 1}
              total={ROUNDS.length}
              detail="One answer"
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={state.round} {...stageCut}>
                <p className="display text-[1.625rem] leading-[1.1] text-foreground sm:text-3xl">
                  {round.text}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {round.options.map((option, index) => (
                    <AnswerOption
                      key={option}
                      index={index}
                      text={option}
                      state={
                        reviewed
                          ? index === round.correct
                            ? "correct"
                            : "dimmed"
                          : undefined
                      }
                      share={answered > 0 ? state.counts[index] / answered : 0}
                      aside={
                        <span className="text-foreground">
                          {formatNumber(state.counts[index])}
                        </span>
                      }
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <p className="mt-3 text-sm text-subtle">
            <span className="font-mono text-muted">{answered}</span> of {ROOM}{" "}
            answered
          </p>
        </div>
        <div className="border-t border-border px-4 py-4 sm:px-6">
          <Leaderboard entries={standings} limit={3} />
        </div>
      </div>
    </figure>
  );
}
