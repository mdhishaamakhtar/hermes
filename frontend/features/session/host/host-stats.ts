/**
 * Answer-statistics helpers for the organiser session.
 *
 * Split out of useHostSession.ts unchanged. Pure functions over the counts and
 * point values the analytics topic delivers.
 */
import {
  normalizeCounts,
  normalizeIdList,
  normalizePoints,
} from "@/lib/session-utils";
import type { DisplayMode, HostSessionSync } from "@/lib/types";
import type { QuestionStats } from "./host-types";

export const DEFAULT_STATS = (): QuestionStats => ({
  counts: {},
  totalAnswered: 0,
  totalLockedIn: 0,
  totalParticipants: 0,
  correctOptionIds: [],
  optionPoints: {},
  revealed: false,
  reviewed: false,
});

export function displayModeLabel(mode: DisplayMode) {
  return mode.replace("_", " ");
}

export function updateStats(
  prev: Record<number, QuestionStats>,
  questionId: number,
  patch: Partial<QuestionStats>,
): Record<number, QuestionStats> {
  const current = prev[questionId] ?? DEFAULT_STATS();
  return {
    ...prev,
    [questionId]: {
      ...current,
      ...patch,
      counts: patch.counts ? patch.counts : current.counts,
      correctOptionIds:
        patch.correctOptionIds ?? current.correctOptionIds ?? [],
      optionPoints: patch.optionPoints
        ? patch.optionPoints
        : current.optionPoints,
    },
  };
}

export function normalizeHostQuestionStats(
  questionStatsById: HostSessionSync["questionStatsById"] | undefined,
) {
  if (!questionStatsById) return {};
  return Object.fromEntries(
    Object.entries(questionStatsById).map(([questionId, stats]) => [
      Number(questionId),
      {
        counts: normalizeCounts(stats.counts ?? {}),
        totalAnswered: stats.totalAnswered ?? 0,
        totalLockedIn: stats.totalLockedIn ?? 0,
        totalParticipants: stats.totalParticipants ?? 0,
        correctOptionIds: normalizeIdList(stats.correctOptionIds ?? []),
        optionPoints: normalizePoints(stats.optionPoints ?? {}),
        revealed: Boolean(stats.revealed),
        reviewed: Boolean(stats.reviewed),
      } satisfies QuestionStats,
    ]),
  ) as Record<number, QuestionStats>;
}
