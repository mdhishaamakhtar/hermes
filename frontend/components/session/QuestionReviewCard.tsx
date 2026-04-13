import { motion } from "framer-motion";
import type { QuestionResult } from "@/lib/types";

interface Props {
  question: QuestionResult;
  participantCount: number;
  isInsidePassage?: boolean;
}

export function QuestionReviewCard({
  question,
  participantCount,
  isInsidePassage,
}: Props) {
  const maxCount = Math.max(...question.options.map((o) => o.count), 1);

  return (
    <div
      className={`${
        isInsidePassage
          ? "p-6 sm:p-8"
          : "border border-border bg-surface p-6 sm:p-8"
      }`}
    >
      <div className="mb-6 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className="label tabular-nums">Q{question.orderIndex}</p>
            <span className="text-muted/40 text-xs">·</span>
            <span className="text-xs text-muted tabular-nums">
              {question.timeLimitSeconds}s time limit
            </span>
            {question.passageId != null ? (
              <>
                <span className="text-muted/40 text-xs">·</span>
                <span className="label text-warning">Passage</span>
              </>
            ) : null}
          </div>
          <h2 className="text-lg font-bold text-foreground leading-snug">
            {question.text}
          </h2>
        </div>
        <div className="ml-4 shrink-0 text-right">
          <p className="label mb-2">Responses</p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {question.totalAnswers}/{participantCount}
          </p>
          <p className="text-xs text-muted tabular-nums mt-1">
            {participantCount > 0
              ? `${Math.round(
                  (question.totalAnswers / participantCount) * 100,
                )}% participation`
              : "No participants"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {question.options
          .toSorted((a, b) => a.orderIndex - b.orderIndex)
          .map((option) => {
            const pct =
              question.totalAnswers > 0
                ? Math.round((option.count / question.totalAnswers) * 100)
                : 0;
            const barWidth = (option.count / maxCount) * 100;

            return (
              <div key={option.id}>
                <div className="mb-1.5 flex items-start justify-between gap-4">
                  <span
                    className={`min-w-0 whitespace-pre-wrap break-words text-sm leading-6 ${
                      option.isCorrect
                        ? "text-success font-medium"
                        : "text-muted"
                    }`}
                  >
                    {option.isCorrect && (
                      <span className="mr-2 text-xs">✓</span>
                    )}
                    {option.text}
                  </span>
                  <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted">
                    {option.count} ({pct}%)
                  </span>
                </div>
                <div className="h-1.5 bg-border overflow-hidden relative rounded-full">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: barWidth / 100 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 32,
                    }}
                    className="h-full absolute inset-0 origin-left rounded-full"
                    style={{
                      background: option.isCorrect
                        ? "var(--color-success)"
                        : "var(--color-primary)",
                      willChange: "transform",
                    }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
