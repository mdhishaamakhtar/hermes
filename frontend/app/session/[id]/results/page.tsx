"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { OPTION_META } from "@/lib/session-constants";
import Logo from "@/components/Logo";
import Spinner from "@/components/Spinner";
import BackLink from "@/components/ui/BackLink";
import { enterAnimation } from "@/lib/design-tokens";
import type { MyResults } from "@/lib/types";

function optionLabel(index: number) {
  return OPTION_META[index % OPTION_META.length];
}

function QuestionResultCard({
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

            const background = chosenCorrect
              ? `rgba(34,197,94,0.12)`
              : chosenWrong
                ? `rgba(239,68,68,0.1)`
                : selected
                  ? `rgba(${meta.rgb},0.14)`
                  : "var(--color-background)";

            const borderColor = chosenCorrect
              ? "rgba(34,197,94,0.7)"
              : chosenWrong
                ? "rgba(239,68,68,0.55)"
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
                        color: selected ? meta.color : "var(--color-muted)",
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

export default function ResultsPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const [results, setResults] = useState<MyResults | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const rejoinToken = localStorage.getItem(`hermes_rejoin_${sessionId}`);
      if (!rejoinToken) {
        setError("Session not found");
        return;
      }

      const response = await api.get<MyResults>(
        `/api/sessions/${sessionId}/my-results`,
        {
          "X-Rejoin-Token": rejoinToken,
        },
      );

      if (response.success) {
        setResults(response.data);
      } else {
        setError(response.error?.message || "Failed to load results");
      }
    })().catch(() => {
      setError("Connection failed");
    });
  }, [sessionId]);

  const accuracy = useMemo(
    () =>
      results && results.totalQuestions > 0
        ? Math.round((results.correctCount / results.totalQuestions) * 100)
        : 0,
    [results],
  );

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <p className="label mb-6 text-danger" role="alert">
          {error}
        </p>
        <Link
          href="/"
          className="label transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Go Home
        </Link>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <span className="label text-success">Results</span>
            <span className="text-xs text-muted tabular-nums">
              #{results.rank} of {results.totalParticipants}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <BackLink href="/" label="Back to Home" />

        <motion.section
          {...enterAnimation}
          className="mt-6 border border-border bg-surface p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label mb-2">{results.displayName}</p>
              <div
                className="font-black tabular-nums text-foreground"
                style={{ fontSize: "clamp(3rem, 8vw, 5rem)", lineHeight: 1 }}
              >
                {results.score.toLocaleString()}
              </div>
              <p className="label mt-2">points</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="border border-border bg-background p-4 text-center">
                <p className="font-bold text-2xl text-foreground tabular-nums leading-none">
                  #{results.rank}
                </p>
                <p className="label mt-1">rank</p>
              </div>
              <div className="border border-border bg-background p-4 text-center">
                <p className="font-bold text-2xl text-foreground tabular-nums leading-none">
                  {accuracy}%
                </p>
                <p className="label mt-1">accuracy</p>
              </div>
              <div className="border border-border bg-background p-4 text-center">
                <p className="font-bold text-2xl text-foreground tabular-nums leading-none">
                  {results.correctCount}/{results.totalQuestions}
                </p>
                <p className="label mt-1">correct</p>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="mt-8 space-y-4">
          <AnimatePresence mode="wait">
            {results.questions
              .toSorted((a, b) => a.orderIndex - b.orderIndex)
              .map((question, index) => (
                <motion.div
                  key={question.questionId}
                  {...enterAnimation}
                  transition={{
                    ...enterAnimation.transition,
                    delay: index * 0.03,
                  }}
                >
                  <QuestionResultCard question={question} />
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
