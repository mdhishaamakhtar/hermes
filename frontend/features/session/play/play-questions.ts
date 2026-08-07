/**
 * Pure helpers that shape participant questions.
 *
 * Split out of usePlaySession.ts unchanged. Everything here is a plain
 * function of its arguments — no hooks, no STOMP, no state — so the reducer
 * and the hook can both use it and it can be reasoned about in isolation.
 */
import {
  normalizeCounts,
  normalizeIdList,
  normalizePoints,
} from "@/lib/session-utils";
import type {
  RejoinCurrentPassageQuestion,
  RejoinCurrentQuestion,
  RejoinQuestionStats,
} from "@/lib/types";
import type { DisplayMode } from "@/lib/types";
import type {
  ParticipantOption,
  ParticipantQuestion,
  SessionQuestionDisplayedMsg,
  SubQuestion,
} from "./play-types";

export function normalizeSelectionIds(selectedOptionIds: number[]) {
  return selectedOptionIds.toSorted((a, b) => a - b);
}

export function createClientRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function formatQuestionSpanLabel(
  startIndex: number | null,
  endIndex: number | null,
  totalQuestions: number | null,
) {
  if (!startIndex || !totalQuestions) return "Waiting";
  if (!endIndex || endIndex <= startIndex) {
    return `Q${startIndex} of ${totalQuestions}`;
  }
  return `Q${startIndex}-Q${endIndex} of ${totalQuestions}`;
}

export function sumQuestionPoints(question: ParticipantQuestion) {
  return Math.max(
    0,
    question.selectedOptionIds.reduce(
      (total, optionId) => total + (question.optionPoints[optionId] ?? 0),
      0,
    ),
  );
}

/** Total points for every question currently visible (e.g. full passage block). */
export function sumVisibleQuestionsPoints(questions: ParticipantQuestion[]) {
  return questions.reduce((sum, q) => sum + sumQuestionPoints(q), 0);
}

export function buildQuestionFromDisplayed(
  question: SessionQuestionDisplayedMsg,
): ParticipantQuestion {
  return {
    id: question.questionId,
    text: question.text,
    questionIndex: question.questionIndex,
    totalQuestions: question.totalQuestions,
    timeLimitSeconds: question.timeLimitSeconds,
    questionType: question.questionType,
    effectiveDisplayMode: question.effectiveDisplayMode,
    passageId: question.passage?.id ?? null,
    options: question.options.toSorted(
      (a: { orderIndex: number }, b: { orderIndex: number }) =>
        a.orderIndex - b.orderIndex,
    ),
    selectedOptionIds: [],
    lockedIn: false,
    counts: {},
    totalAnswered: 0,
    totalLockedIn: 0,
    correctOptionIds: [],
    optionPoints: {},
    reviewed: false,
    revealed: false,
    reviewedAt: null,
  };
}

export function buildQuestionFromPassageSubQuestion(
  question: SubQuestion,
  questionIndex: number,
  totalQuestions: number,
  timeLimitSeconds: number,
  effectiveDisplayMode: DisplayMode,
  passageId: number,
): ParticipantQuestion {
  return {
    id: question.questionId,
    text: question.text,
    questionIndex,
    totalQuestions,
    timeLimitSeconds,
    questionType: question.questionType,
    effectiveDisplayMode,
    passageId,
    options: question.options.toSorted(
      (a: ParticipantOption, b: ParticipantOption) =>
        a.orderIndex - b.orderIndex,
    ),
    selectedOptionIds: [],
    lockedIn: false,
    counts: {},
    totalAnswered: 0,
    totalLockedIn: 0,
    correctOptionIds: [],
    optionPoints: {},
    reviewed: false,
    revealed: false,
    reviewedAt: null,
  };
}

export function buildQuestionFromRejoin(
  question: RejoinCurrentQuestion | RejoinCurrentPassageQuestion,
  totalQuestions: number,
  effectiveDisplayMode: DisplayMode,
  passageIdFromContext: number | null = null,
  timeLimitSecondsOverride?: number,
): ParticipantQuestion {
  const pId =
    passageIdFromContext ??
    ("passage" in question ? (question.passage?.id ?? null) : null);

  return {
    id: question.id,
    text: question.text,
    questionIndex: question.orderIndex,
    totalQuestions,
    timeLimitSeconds: timeLimitSecondsOverride ?? question.timeLimitSeconds,
    questionType: question.questionType,
    effectiveDisplayMode,
    passageId: pId,
    options: question.options.toSorted(
      (a: { orderIndex: number }, b: { orderIndex: number }) =>
        a.orderIndex - b.orderIndex,
    ),
    selectedOptionIds: question.selectedOptionIds,
    lockedIn: question.lockedIn,
    counts: {},
    totalAnswered: 0,
    totalLockedIn: question.lockedIn ? 1 : 0,
    correctOptionIds: [],
    optionPoints: {},
    reviewed: false,
    revealed: false,
    reviewedAt: null,
  };
}

export function applyRejoinStats(
  question: ParticipantQuestion,
  statsById: Record<number, RejoinQuestionStats> | undefined,
): ParticipantQuestion {
  const stats = statsById?.[question.id];
  if (!stats) {
    return question;
  }

  return {
    ...question,
    counts: normalizeCounts(stats.counts ?? {}),
    totalAnswered: stats.totalAnswered ?? 0,
    totalLockedIn: stats.totalLockedIn ?? (question.lockedIn ? 1 : 0),
    correctOptionIds: normalizeIdList(stats.correctOptionIds ?? []),
    optionPoints: normalizePoints(stats.optionPoints ?? {}),
    reviewed: Boolean(stats.reviewed),
    revealed: Boolean(stats.revealed),
  };
}

export function updateQuestion(
  prev: ParticipantQuestion[],
  questionId: number,
  patch: Partial<ParticipantQuestion>,
) {
  return prev.map((question) =>
    question.id === questionId ? { ...question, ...patch } : question,
  );
}

export function setQuestionSelection(
  questions: ParticipantQuestion[],
  questionId: number,
  nextSelection: number[],
) {
  return questions.map((question) =>
    question.id === questionId
      ? { ...question, selectedOptionIds: nextSelection }
      : question,
  );
}
