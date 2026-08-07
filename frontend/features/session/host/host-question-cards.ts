/**
 * Adapters from session state to the shape QuestionCard renders.
 *
 * Split out of useHostSession.ts unchanged. Kept apart from the reducer
 * because these shape data for the view rather than owning any of it.
 */
import type { QuestionCardData } from "@/features/session/components/QuestionCard";
import type { SessionResults } from "@/lib/types";
import type { ActiveQuestion, QuestionStats } from "./host-types";
import { DEFAULT_STATS } from "./host-stats";

export function buildActiveQuestionCard(
  question: ActiveQuestion,
  stats: QuestionStats | undefined,
): QuestionCardData {
  const normalized = stats ?? DEFAULT_STATS();
  const counts = normalized.counts;
  const pointMap = normalized.optionPoints;
  const totalAnswers = normalized.totalAnswered;
  const usePointMapForKey =
    normalized.reviewed && Object.keys(pointMap).length > 0;

  return {
    id: question.id,
    text: question.text,
    orderIndex: question.orderIndex,
    timeLimitSeconds: question.timeLimitSeconds,
    totalAnswers,
    totalLockedIn: normalized.totalLockedIn,
    totalParticipants: normalized.totalParticipants,
    passageId: question.passage?.id ?? null,
    options: question.options
      .toSorted((a, b) => a.orderIndex - b.orderIndex)
      .map((option) => ({
        id: option.id,
        text: option.text,
        orderIndex: option.orderIndex,
        count: counts[option.id] ?? 0,
        isCorrect: usePointMapForKey
          ? (pointMap[option.id] ?? 0) > 0
          : (normalized.correctOptionIds ?? []).includes(option.id),
        pointValue: pointMap[option.id] ?? 0,
      })),
  };
}

export function buildResultsQuestionCard(
  question: SessionResults["questions"][number],
): QuestionCardData {
  const totalAnswers = question.totalAnswers;

  return {
    id: question.id,
    text: question.text,
    orderIndex: question.orderIndex,
    timeLimitSeconds: question.timeLimitSeconds,
    totalAnswers,
    passageId: question.passageId,
    options: question.options
      .toSorted((a, b) => a.orderIndex - b.orderIndex)
      .map((option) => ({
        id: option.id,
        text: option.text,
        orderIndex: option.orderIndex,
        count: option.count,
        isCorrect: option.isCorrect,
        pointValue: option.pointValue,
      })),
  };
}
