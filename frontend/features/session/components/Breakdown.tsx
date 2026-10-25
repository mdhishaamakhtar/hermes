"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { countLabel, formatNumber, formatPoints, percent } from "@/lib/format";
import { revealRow } from "@/lib/motion";
import { byOrderIndex } from "@/lib/options";
import {
  groupByPassage,
  VERDICT_LABEL,
  verdictOf,
  type Verdict,
} from "../session-state";
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
  asked = true,
  children,
}: {
  number: number;
  text: string;
  meta: ReactNode;
  action?: ReactNode;
  /** False for a question the session ended before reaching. */
  asked?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      className={`border border-border bg-surface p-5 sm:p-6 ${asked ? "" : "opacity-60"}`}
    >
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
      asked={question.asked}
      meta={
        question.asked ? (
          <>
            {question.poll && <span>Poll</span>}
            <span>
              {formatNumber(question.totalAnswers)} of{" "}
              {countLabel(participantCount, "player", "players")}{" "}
              {question.poll ? "voted" : "answered"}
            </span>
          </>
        ) : (
          <span>
            <Badge>Not asked</Badge>
          </span>
        )
      }
      action={
        question.asked &&
        !question.poll &&
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
              question.asked && question.totalAnswers > 0
                ? option.count / question.totalAnswers
                : undefined
            }
            aside={
              question.asked && (
                <>
                  <span className="text-foreground">
                    {formatNumber(option.count)}
                  </span>
                  <span className="w-10 text-right text-muted">
                    {percent(option.count, question.totalAnswers)}%
                  </span>
                </>
              )
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
  poll: boolean,
): OptionState | undefined {
  if (poll) return selected ? "selected" : undefined;
  if (selected) return correct ? "correct" : "wrong";
  return correct ? "missed" : undefined;
}

const VERDICT_TONE: Record<Verdict, BadgeTone> = {
  correct: "success",
  partial: "warning",
  wrong: "danger",
  voted: "neutral",
  none: "neutral",
};

/** One question as a player answered it: their picks against the key. */
export function MyQuestionBreakdown({
  question,
}: {
  question: MyQuestionResult;
}) {
  const verdict = verdictOf({
    selected: question.selectedOptionIds,
    correctOptionIds: question.correctOptionIds,
    earned: question.pointsEarned,
    multiSelect: question.questionType === "MULTI_SELECT",
    poll: question.poll,
  });
  return (
    <QuestionShell
      number={question.orderIndex}
      text={question.questionText}
      asked={question.asked}
      meta={
        question.asked ? (
          <>
            <span>
              <Badge tone={VERDICT_TONE[verdict]}>
                {VERDICT_LABEL[verdict]}
              </Badge>
            </span>
            {question.poll ? (
              <span>Poll</span>
            ) : (
              <span className="font-mono text-foreground">
                {formatPoints(question.pointsEarned)} pts
              </span>
            )}
          </>
        ) : (
          <span>
            <Badge>Not asked</Badge>
          </span>
        )
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
              state={stateFor(selected, correct, question.poll)}
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
