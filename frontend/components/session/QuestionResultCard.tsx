"use client";

import { colorRgb } from "@/lib/design-tokens";
import { optionLabel } from "@/lib/session-utils";
import type { MyResults } from "@/lib/types";

export function QuestionResultCard({
  question,
}: {
  question: MyResults["questions"][number];
}) {
  const selectedCount = question.selectedOptionIds.length;
  const score = question.pointsEarned;

  return (
    <article className="border border-border bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="label tabular-nums">Q{question.orderIndex}</p>
            <span className="text-xs text-muted/40">·</span>
            <span className="label text-accent">
              {question.questionType.replace("_", " ")}
            </span>
            {question.passageText ? (
              <>
                <span className="text-xs text-muted/40">·</span>
                <span className="label text-warning">Passage</span>
              </>
            ) : null}
          </div>
          <h2 className="max-w-3xl text-xl font-bold leading-snug text-foreground">
            {question.questionText}
          </h2>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
          <span
            className={`label ${
              question.isCorrect ? "text-success" : "text-danger"
            }`}
          >
            {question.isCorrect ? "Correct" : "Incorrect"}
          </span>
          <span className="text-xs text-muted tabular-nums">
            {score > 0 ? `+${score}` : score} pts
          </span>
        </div>
      </div>

      {question.passageText ? (
        <div className="mt-4 border border-border bg-background p-4">
          <p className="label mb-2 text-warning">Passage</p>
          <p className="text-sm leading-7 text-muted">{question.passageText}</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {question.options
          .toSorted((a, b) => a.orderIndex - b.orderIndex)
          .map((option, index) => {
            const meta = optionLabel(index);
            const selected = question.selectedOptionIds.includes(option.id);
            const correct = question.correctOptionIds.includes(option.id);
            const chosenCorrect = selected && correct;
            const chosenWrong = selected && !correct;
            const missedCorrect = !selected && correct;

            const background = chosenCorrect
              ? `rgba(${colorRgb.success},0.12)`
              : chosenWrong
                ? `rgba(${colorRgb.danger},0.1)`
                : missedCorrect
                  ? `rgba(${colorRgb.success},0.05)`
                  : selected
                    ? `rgba(${meta.rgb},0.14)`
                    : "var(--color-background)";

            const borderColor = chosenCorrect
              ? `rgba(${colorRgb.success},0.7)`
              : chosenWrong
                ? `rgba(${colorRgb.danger},0.55)`
                : missedCorrect
                  ? `rgba(${colorRgb.success},0.28)`
                  : selected
                    ? meta.color
                    : "var(--color-border)";

            return (
              <div
                key={option.id}
                className="border px-4 py-4"
                style={{ backgroundColor: background, borderColor }}
              >
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
                            : chosenWrong
                              ? "var(--color-danger)"
                              : selected
                                ? meta.color
                                : "var(--color-muted)",
                      }}
                    >
                      {meta.letter}
                    </span>
                    <span className="min-w-0 truncate text-sm text-foreground">
                      {option.text}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                    <span
                      className={`border px-2 py-1 ${
                        option.pointValue > 0
                          ? "border-success/25 text-success"
                          : option.pointValue < 0
                            ? "border-danger/25 text-danger"
                            : "border-border text-muted"
                      }`}
                    >
                      {option.pointValue > 0
                        ? `+${option.pointValue}`
                        : option.pointValue}
                    </span>
                    {chosenCorrect ? (
                      <span className="text-success">✓</span>
                    ) : missedCorrect ? (
                      <span style={{ color: `rgba(${colorRgb.success},0.55)` }}>
                        ○
                      </span>
                    ) : chosenWrong ? (
                      <span className="text-danger">✕</span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted">
          {selectedCount > 0 ? `${selectedCount} selected` : "Not answered"}
        </p>
        <p className="text-xs text-muted">
          Correct options are highlighted in green.
        </p>
      </div>
    </article>
  );
}
