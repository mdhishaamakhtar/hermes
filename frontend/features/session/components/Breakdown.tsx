"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { countLabel, formatNumber, formatPoints, percent } from "@/lib/format";
import { revealRow } from "@/lib/motion";
import { byOrderIndex } from "@/lib/options";
import { groupByPassage } from "../session-state";
import type { MyQuestionResult, QuestionResult } from "../session-types";
import { AnswerOption, type OptionState } from "./AnswerOption";
import { PassagePanel } from "./SessionChrome";

/**
 * Finished questions laid out in running order, with each passage's text
 * shown once above the questions that belong to it.
 */
export function ResultGroups<
  Q extends { passageId: number | null; passageText: string | null },
>({
  questions,
  getKey,
  renderQuestion,
}: {
  questions: Q[];
  getKey: (question: Q) => number;
  renderQuestion: (question: Q) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {groupByPassage(questions).map((group, index) => (
        <motion.div
          key={
            group.kind === "single"
              ? getKey(group.question)
              : `p${group.passageId}`
          }
          {...revealRow(index)}
          className="flex flex-col gap-3"
        >
          {group.kind === "single" ? (
            renderQuestion(group.question)
          ) : (
            <>
              <PassagePanel text={group.text} />
              {group.questions.map((question) => (
                <div key={getKey(question)}>{renderQuestion(question)}</div>
              ))}
            </>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function QuestionShell({
  number,
  text,
  meta,
  action,
  children,
}: {
  number: number;
  text: string;
  meta: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="border border-border bg-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-72">
          <p className="meta-line text-sm text-subtle">
            <span className="font-mono font-medium text-muted">Q{number}</span>
            {meta}
          </p>
          <h3 className="mt-2 text-lg leading-snug font-semibold whitespace-pre-wrap text-foreground">
            {text}
          </h3>
        </div>
        {action}
      </div>
      <ul className="grid gap-2 lg:grid-cols-2">{children}</ul>
    </article>
  );
}

/** One question's answer spread, for the organiser. */
export function QuestionBreakdown({
  question,
  participantCount,
  onEditScoring,
}: {
  question: QuestionResult;
  participantCount: number;
  onEditScoring?: () => void;
}) {
  return (
    <QuestionShell
      number={question.orderIndex}
      text={question.text}
      meta={
        <span>
          {formatNumber(question.totalAnswers)} of{" "}
          {countLabel(participantCount, "player", "players")} answered
        </span>
      }
      action={
        onEditScoring && (
          <Button size="sm" icon="pencil" onClick={onEditScoring}>
            Edit scoring
          </Button>
        )
      }
    >
      {byOrderIndex(question.options).map((option, index) => (
        <li key={option.id}>
          <AnswerOption
            index={index}
            text={option.text}
            state={option.isCorrect ? "correct" : undefined}
            share={
              question.totalAnswers > 0
                ? option.count / question.totalAnswers
                : 0
            }
            aside={
              <>
                <span className="text-foreground">
                  {formatNumber(option.count)}
                </span>
                <span className="w-10 text-right text-subtle">
                  {percent(option.count, question.totalAnswers)}%
                </span>
              </>
            }
          />
        </li>
      ))}
    </QuestionShell>
  );
}

function stateFor(
  selected: boolean,
  correct: boolean,
): OptionState | undefined {
  if (selected) return correct ? "correct" : "wrong";
  return correct ? "missed" : undefined;
}

/**
 * How an answer went, in a word. Only an exact match is correct, but a pick
 * of some right answers can still score; calling that "Incorrect" beside
 * "+10 pts" would contradict itself.
 */
function verdict(question: MyQuestionResult) {
  if (question.selectedOptionIds.length === 0)
    return { label: "No answer", tone: "neutral" } as const;
  if (question.isCorrect) return { label: "Correct", tone: "success" } as const;
  return question.pointsEarned > 0
    ? ({ label: "Partly right", tone: "warning" } as const)
    : ({ label: "Incorrect", tone: "danger" } as const);
}

/** One question as a player answered it: their picks against the key. */
export function MyQuestionBreakdown({
  question,
}: {
  question: MyQuestionResult;
}) {
  const { label, tone } = verdict(question);
  return (
    <QuestionShell
      number={question.orderIndex}
      text={question.questionText}
      meta={
        <>
          <span>
            <Badge tone={tone}>{label}</Badge>
          </span>
          <span className="font-mono text-foreground">
            {formatPoints(question.pointsEarned)} pts
          </span>
        </>
      }
    >
      {byOrderIndex(question.options).map((option, index) => {
        const selected = question.selectedOptionIds.includes(option.id);
        const correct = question.correctOptionIds.includes(option.id);
        return (
          <li key={option.id}>
            <AnswerOption
              index={index}
              text={option.text}
              state={stateFor(selected, correct)}
              aside={
                option.pointValue !== 0 && (
                  <span
                    className={
                      option.pointValue > 0 ? "text-success" : "text-danger"
                    }
                  >
                    {formatPoints(option.pointValue)}
                  </span>
                )
              }
            />
          </li>
        );
      })}
    </QuestionShell>
  );
}
