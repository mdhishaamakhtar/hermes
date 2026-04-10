"use client";

import { motion } from "framer-motion";
import { colorRgb } from "@/lib/design-tokens";
import { optionLabel } from "@/lib/session-utils";
import type { QuestionType } from "@/lib/types";

type QuestionLifecycle = "DISPLAYED" | "TIMED" | "FROZEN" | "REVIEWING";

interface ParticipantQuestionCardQuestion {
  id: number;
  text: string;
  questionIndex: number;
  timeLimitSeconds: number;
  questionType: QuestionType;
  passageText: string | null;
  options: Array<{ id: number; text: string; orderIndex: number }>;
  selectedOptionIds: number[];
  lockedIn: boolean;
  counts: Record<number, number>;
  totalAnswered: number;
  totalLockedIn: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
  reviewed: boolean;
}

interface ParticipantQuestionCardProps {
  question: ParticipantQuestionCardQuestion;
  lifecycle: QuestionLifecycle;
  onToggleOption: (questionId: number, optionId: number) => void;
  onLockIn: (questionId: number) => void;
}

function sumQuestionPoints(question: ParticipantQuestionCardQuestion) {
  return Math.max(
    0,
    question.selectedOptionIds.reduce(
      (total, optionId) => total + (question.optionPoints[optionId] ?? 0),
      0,
    ),
  );
}

function currentQuestionLabel(
  question: ParticipantQuestionCardQuestion,
  lifecycle: QuestionLifecycle,
) {
  if (question.questionType === "MULTI_SELECT") {
    return lifecycle === "TIMED"
      ? `${question.selectedOptionIds.length} selected`
      : "Select all that apply";
  }
  return lifecycle === "TIMED"
    ? "Tap another option to change"
    : "Single choice";
}

export function ParticipantQuestionCard({
  question,
  lifecycle,
  onToggleOption,
  onLockIn,
}: ParticipantQuestionCardProps) {
  const resolved = lifecycle === "REVIEWING" || question.reviewed;
  const interactive = lifecycle === "TIMED" && !question.lockedIn;
  const maxCount = Math.max(
    1,
    ...question.options.map((option) => question.counts[option.id] ?? 0),
  );
  const questionScore = resolved ? sumQuestionPoints(question) : null;

  return (
    <article className="border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="label tabular-nums">Q{question.questionIndex}</p>
            <span className="text-xs text-muted/40">·</span>
            <span className="text-xs text-muted tabular-nums">
              {question.timeLimitSeconds || 0}s
            </span>
            {question.questionType === "MULTI_SELECT" ? (
              <>
                <span className="text-xs text-muted/40">·</span>
                <span className="label text-accent">Multi-select</span>
              </>
            ) : null}
            {question.passageText ? (
              <>
                <span className="text-xs text-muted/40">·</span>
                <span className="label text-warning">Passage</span>
              </>
            ) : null}
          </div>
          <h2 className="max-w-3xl text-2xl font-bold leading-snug text-foreground">
            {question.text}
          </h2>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
          <span className="text-sm tabular-nums text-foreground">
            {question.totalAnswered} answered
          </span>
          {question.totalLockedIn > 0 ? (
            <span className="text-xs tabular-nums text-muted">
              {question.totalLockedIn} locked in
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {question.options.map((option, index) => {
          const meta = optionLabel(index);
          const count = question.counts[option.id] ?? 0;
          const isSelected = question.selectedOptionIds.includes(option.id);
          const isCorrect = question.correctOptionIds.includes(option.id);
          const isWrongSelected = resolved && isSelected && !isCorrect;
          const pointValue = question.optionPoints[option.id] ?? 0;
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

          const chosenCorrect = resolved && isCorrect && isSelected;
          const missedCorrect = resolved && isCorrect && !isSelected;

          const bgStyle = chosenCorrect
            ? `rgba(${colorRgb.success},0.15)`
            : missedCorrect
              ? `rgba(${colorRgb.success},0.06)`
              : isWrongSelected
                ? `rgba(${colorRgb.danger},0.1)`
                : isSelected
                  ? `rgba(${meta.rgb},0.14)`
                  : "var(--color-background)";

          const borderColor = chosenCorrect
            ? `rgba(${colorRgb.success},0.8)`
            : missedCorrect
              ? `rgba(${colorRgb.success},0.3)`
              : isWrongSelected
                ? `rgba(${colorRgb.danger},0.6)`
                : isSelected
                  ? meta.color
                  : "var(--color-border)";

          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-bold tracking-widest"
                    style={{
                      borderColor,
                      color: chosenCorrect
                        ? "var(--color-success)"
                        : missedCorrect
                          ? `rgba(${colorRgb.success},0.55)`
                          : isWrongSelected
                            ? "var(--color-danger)"
                            : isSelected
                              ? meta.color
                              : "var(--color-muted)",
                    }}
                  >
                    {meta.letter}
                  </span>
                  <span className="min-w-0 text-sm text-foreground">
                    {option.text}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                  {interactive || resolved ? (
                    <span className="text-muted">{count}</span>
                  ) : null}
                  {resolved ? (
                    <span
                      className={`border px-2 py-1 ${
                        pointValue > 0
                          ? "border-success/25 text-success"
                          : pointValue < 0
                            ? "border-danger/25 text-danger"
                            : "border-border text-muted"
                      }`}
                    >
                      {pointValue > 0 ? `+${pointValue}` : pointValue}
                    </span>
                  ) : null}
                  {chosenCorrect ? (
                    <span className="text-success">✓</span>
                  ) : missedCorrect ? (
                    <span style={{ color: `rgba(${colorRgb.success},0.55)` }}>
                      ○
                    </span>
                  ) : isWrongSelected ? (
                    <span className="text-danger">✕</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden border border-border bg-background">
                <motion.div
                  className="h-full origin-left"
                  animate={{ scaleX: barWidth / 100 }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  style={{
                    backgroundColor:
                      resolved && isCorrect
                        ? "var(--color-success)"
                        : meta.color,
                    willChange: "transform",
                  }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                <span>{interactive ? "Tap to change" : "Locked"}</span>
                {resolved && isSelected && questionScore !== null ? (
                  <span className="tabular-nums text-foreground">
                    {questionScore > 0 ? `+${questionScore} pts` : "0 pts"}
                  </span>
                ) : null}
              </div>
            </>
          );

          const sharedClasses =
            "w-full border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

          if (interactive) {
            return (
              <motion.button
                key={option.id}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => onToggleOption(question.id, option.id)}
                className={sharedClasses}
                style={{
                  backgroundColor: bgStyle,
                  borderColor,
                }}
              >
                {content}
              </motion.button>
            );
          }

          return (
            <div
              key={option.id}
              className={`${sharedClasses} cursor-default`}
              style={{
                backgroundColor: bgStyle,
                borderColor,
                opacity: lifecycle === "DISPLAYED" ? 0.82 : 1,
              }}
            >
              {content}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted">
          {lifecycle === "DISPLAYED"
            ? "Waiting for host to start the timer."
            : lifecycle === "TIMED"
              ? currentQuestionLabel(question, lifecycle)
              : lifecycle === "FROZEN"
                ? "Time's up. Grading in progress."
                : resolved
                  ? `You scored ${questionScore ?? 0} points.`
                  : "Results loading..."}
        </p>

        {lifecycle === "TIMED" && !question.lockedIn ? (
          <button
            type="button"
            onClick={() => onLockIn(question.id)}
            disabled={question.selectedOptionIds.length === 0}
            className="border border-border px-4 py-2 text-xs tracking-widest uppercase text-muted transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Lock In
          </button>
        ) : question.lockedIn ? (
          <span className="label text-success">Locked</span>
        ) : null}
      </div>
    </article>
  );
}
