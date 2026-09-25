/**
 * Pure helpers shared by the organiser and player session state machines,
 * and by every screen that lays out finished results.
 */
import type { QuestionStats } from "./session-types";

/** JSON object keys arrive as strings; the id-keyed maps use numbers. */
export function numberKeyed(
  record: Record<string | number, number> | undefined,
): Record<number, number> {
  return Object.fromEntries(
    Object.entries(record ?? {}).map(([key, value]) => [
      Number(key),
      Number(value),
    ]),
  );
}

export function emptyStats(): QuestionStats {
  return {
    counts: {},
    totalAnswered: 0,
    totalLockedIn: 0,
    totalParticipants: 0,
    correctOptionIds: [],
    optionPoints: {},
    revealed: false,
    reviewed: false,
  };
}

/** A stats snapshot from REST, with its maps and ids made numeric. */
export function statsFromSnapshot(
  raw: Record<string, QuestionStats> | undefined,
): Record<number, QuestionStats> {
  return Object.fromEntries(
    Object.entries(raw ?? {}).map(([questionId, stats]) => [
      Number(questionId),
      {
        counts: numberKeyed(stats.counts),
        totalAnswered: stats.totalAnswered ?? 0,
        totalLockedIn: stats.totalLockedIn ?? 0,
        totalParticipants: stats.totalParticipants ?? 0,
        correctOptionIds: (stats.correctOptionIds ?? []).map(Number),
        optionPoints: numberKeyed(stats.optionPoints),
        revealed: Boolean(stats.revealed),
        reviewed: Boolean(stats.reviewed),
      } satisfies QuestionStats,
    ]),
  );
}

/**
 * The options that score. The point map wins when present, because it
 * reflects any correction the organiser made after grading.
 */
export function scoringOptionIds(
  optionPoints: Record<number, number>,
  correctOptionIds: number[],
): number[] {
  const fromPoints = Object.entries(optionPoints)
    .filter(([, points]) => points > 0)
    .map(([id]) => Number(id));
  return fromPoints.length > 0 ? fromPoints : correctOptionIds.map(Number);
}

export function patchStats(
  all: Record<number, QuestionStats>,
  questionId: number,
  patch: Partial<QuestionStats>,
): Record<number, QuestionStats> {
  return {
    ...all,
    [questionId]: { ...(all[questionId] ?? emptyStats()), ...patch },
  };
}

/**
 * The running clock of a question. `run` changes whenever the server
 * (re)starts it, which restarts the draining bar from `startLeft`; `left`
 * ticks down locally for the digits in between.
 */
export interface Countdown {
  limit: number;
  left: number;
  startLeft: number;
  run: number;
}

export const IDLE_COUNTDOWN: Countdown = {
  limit: 0,
  left: 0,
  startLeft: 0,
  run: 0,
};

export function startCountdown(
  previous: Countdown,
  left: number,
  limit: number,
): Countdown {
  const safeLeft = Math.max(0, left);
  return {
    limit: Math.max(limit, safeLeft),
    left: safeLeft,
    startLeft: safeLeft,
    run: previous.run + 1,
  };
}

export function tickCountdown(countdown: Countdown): Countdown {
  return countdown.left > 0
    ? { ...countdown, left: countdown.left - 1 }
    : countdown;
}

/** Consecutive questions from one passage, grouped for display. */
export type PassageGroup<Q> =
  | { kind: "single"; question: Q }
  | { kind: "passage"; passageId: number; text: string; questions: Q[] };

export function groupByPassage<
  Q extends { passageId: number | null; passageText: string | null },
>(questions: Q[]): PassageGroup<Q>[] {
  const groups: PassageGroup<Q>[] = [];
  for (const question of questions) {
    const last = groups.at(-1);
    if (question.passageId == null) {
      groups.push({ kind: "single", question });
    } else if (
      last?.kind === "passage" &&
      last.passageId === question.passageId
    ) {
      last.questions.push(question);
    } else {
      groups.push({
        kind: "passage",
        passageId: question.passageId,
        text: question.passageText ?? "",
        questions: [question],
      });
    }
  }
  return groups;
}
