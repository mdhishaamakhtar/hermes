"use client";

import { motion } from "framer-motion";
import { OPTION_META } from "@/lib/session-constants";
import { CardBadge } from "./CardBadge";

export interface QuestionCardOption {
  id: number;
  text: string;
  orderIndex: number;
  count: number;
  isCorrect: boolean;
  pointValue: number;
}

export interface QuestionCardData {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  totalAnswers: number;
  totalLockedIn?: number;
  totalParticipants?: number;
  options: QuestionCardOption[];
  passageText?: string | null;
  passageId?: number | null;
}

export function QuestionCard({
  question,
  mode,
  isInsidePassage,
  onEdit,
}: {
  question: QuestionCardData;
  mode: "display" | "timed-live" | "timed-summary" | "review";
  isInsidePassage?: boolean;
  onEdit?: () => void;
}) {
  const showMetrics = mode !== "display";
  const maxCount = Math.max(
    1,
    ...question.options.map((option) => option.count),
  );

  return (
    <article className="border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="label tabular-nums">Q{question.orderIndex}</p>
            <span className="text-xs text-muted/50">·</span>
            {question.timeLimitSeconds > 0 && (
              <span className="text-xs text-muted tabular-nums">
                {question.timeLimitSeconds}s time limit
              </span>
            )}
            {question.passageText ? (
              <CardBadge tone="accent">Passage</CardBadge>
            ) : null}
          </div>
          <h2 className="text-2xl font-bold leading-snug text-foreground">
            {question.text}
          </h2>
          {question.passageText && mode === "review" && !isInsidePassage ? (
            <div className="mt-4 border border-border bg-background p-4">
              <p className="label mb-3 text-warning">Passage</p>
              <div
                className="prose prose-invert max-w-3xl text-sm leading-7 text-muted prose-p:my-0 prose-p:leading-7"
                dangerouslySetInnerHTML={{ __html: question.passageText }}
              />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-start gap-3">
          {showMetrics ? (
            <div className="text-right">
              <div className="text-sm tabular-nums text-foreground">
                {question.totalAnswers} responded
              </div>
              {question.totalLockedIn !== undefined ? (
                <div className="text-xs text-muted tabular-nums">
                  {question.totalLockedIn} locked in
                </div>
              ) : null}
            </div>
          ) : null}

          {onEdit ? (
            <button
              onClick={onEdit}
              className="border border-border px-4 py-2 text-xs tracking-widest uppercase text-muted transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Edit scoring
            </button>
          ) : null}
        </div>
      </div>

      {mode === "display" ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {question.options.map((option, index) => {
            const meta = OPTION_META[index % OPTION_META.length];
            return (
              <div
                key={option.id}
                className="border border-border px-3 py-2 text-sm text-foreground"
              >
                <span
                  className="mr-3 inline-flex h-6 w-6 items-center justify-center border text-[11px] font-bold tracking-widest"
                  style={{
                    borderColor: `${meta.color}55`,
                    color: meta.color,
                  }}
                >
                  {meta.letter}
                </span>
                <span className="align-middle">{option.text}</span>
              </div>
            );
          })}
        </div>
      ) : mode === "timed-summary" ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {question.options.map((option, index) => {
            const meta = OPTION_META[index % OPTION_META.length];
            return (
              <div
                key={option.id}
                className="border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center border text-[11px] font-bold tracking-widest"
                    style={{
                      borderColor: `${meta.color}55`,
                      color: meta.color,
                    }}
                  >
                    {meta.letter}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {question.options.map((option, index) => {
            const meta = OPTION_META[index % OPTION_META.length];
            const pct = (option.count / maxCount) * 100;

            return (
              <div key={option.id}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center border text-[11px] font-bold tracking-widest"
                      style={{
                        borderColor: `${meta.color}55`,
                        color: meta.color,
                      }}
                    >
                      {meta.letter}
                    </span>
                    <span className="min-w-0 truncate text-sm text-foreground">
                      {option.text}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs tabular-nums">
                    <span
                      className={
                        option.isCorrect ? "text-success" : "text-muted"
                      }
                    >
                      {option.count}
                    </span>
                    {mode === "review" ? (
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
                    ) : null}
                    {option.isCorrect ? (
                      <span className="text-success">✓</span>
                    ) : null}
                  </div>
                </div>
                <div className="h-3 bg-background overflow-hidden border border-border">
                  <motion.div
                    initial={false}
                    animate={{ scaleX: pct / 100 }}
                    transition={{
                      type: "spring",
                      stiffness: 240,
                      damping: 30,
                    }}
                    className="h-full origin-left"
                    style={{
                      backgroundColor: option.isCorrect
                        ? "var(--color-success)"
                        : meta.color,
                      willChange: "transform",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
