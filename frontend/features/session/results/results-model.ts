/**
 * What a finished session says once it is read as a whole: the question
 * that beat the room, the wrong answer the room fell for, and the session as
 * a spreadsheet. Pure, so the review page and the export agree.
 */
import { byOrderIndex, optionLetter } from "@/lib/options";
import type {
  QuestionResult,
  ResultOption,
  SessionResults,
} from "../session-types";

/** Questions with a right answer that were asked and answered. */
function scoredQuestions(results: SessionResults): QuestionResult[] {
  return results.questions.filter(
    (question) => question.asked && !question.poll && question.totalAnswers > 0,
  );
}

export interface HardestQuestion {
  question: QuestionResult;
  right: number;
  answered: number;
}

/**
 * The question the fewest answerers got right. Said only once there are two
 * to compare, since one question can't be the hardest of one.
 */
export function hardestQuestion(
  results: SessionResults,
): HardestQuestion | null {
  const scored = scoredQuestions(results);
  if (scored.length < 2) return null;
  const rightCount = (questionId: number) =>
    results.players.filter((player) =>
      player.answers.some(
        (answer) => answer.questionId === questionId && answer.correct,
      ),
    ).length;
  return scored
    .map((question) => ({
      question,
      right: rightCount(question.id),
      answered: question.totalAnswers,
    }))
    .reduce((hardest, next) =>
      next.right / next.answered < hardest.right / hardest.answered
        ? next
        : hardest,
    );
}

export interface CommonWrongAnswer {
  question: QuestionResult;
  option: ResultOption;
  letter: string;
}

/** The wrong option picked by the largest share of a question's answerers. */
export function commonWrongAnswer(
  results: SessionResults,
): CommonWrongAnswer | null {
  let best: (CommonWrongAnswer & { share: number }) | null = null;
  for (const question of scoredQuestions(results)) {
    byOrderIndex(question.options).forEach((option, index) => {
      if (option.isCorrect || option.count === 0) return;
      const share = option.count / question.totalAnswers;
      if (!best || share > best.share) {
        best = { question, option, letter: optionLetter(index), share };
      }
    });
  }
  return best;
}

/**
 * Guards a spreadsheet cell: quotes it when needed, and defuses text a
 * spreadsheet would run as a formula (player names are typed by anyone).
 */
function cell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * The session as a spreadsheet: one row per player in standings order, then
 * for each question asked, the letters they picked and the points it earned.
 */
export function resultsCsv(results: SessionResults): string {
  const asked = results.questions.filter((question) => question.asked);
  const header = [
    "Rank",
    "Player",
    "Score",
    "Right",
    "Answered",
    ...asked.flatMap((question) => [
      `Q${question.orderIndex} answer`,
      `Q${question.orderIndex} points`,
    ]),
  ];
  const rows = results.players.map((player) => [
    player.rank,
    player.displayName,
    player.score,
    player.correctCount,
    player.answeredCount,
    ...asked.flatMap((question) => {
      const answer = player.answers.find((a) => a.questionId === question.id);
      if (!answer || answer.selectedOptionIds.length === 0) return ["", ""];
      const letters = byOrderIndex(question.options)
        .map((option, index) =>
          answer.selectedOptionIds.includes(option.id)
            ? optionLetter(index)
            : null,
        )
        .filter(Boolean)
        .join(" ");
      return [letters, question.poll ? "" : answer.score];
    }),
  ]);
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

/** A file name a person would recognise later: quiz, then the day it ran. */
export function resultsFileName(results: SessionResults): string {
  const slug =
    results.quizTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "session";
  const day = (results.startedAt ?? results.endedAt ?? "").slice(0, 10);
  return `hermes-${slug}${day ? `-${day}` : ""}.csv`;
}
