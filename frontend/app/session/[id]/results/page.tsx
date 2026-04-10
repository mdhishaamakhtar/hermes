"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import Logo from "@/components/Logo";
import Spinner from "@/components/Spinner";
import BackLink from "@/components/ui/BackLink";
import { QuestionResultCard } from "@/components/session/QuestionResultCard";
import { enterAnimation } from "@/lib/design-tokens";
import { getStoredRejoinToken } from "@/lib/session-storage";
import type { MyResults } from "@/lib/types";

export default function ResultsPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const [results, setResults] = useState<MyResults | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const rejoinToken = getStoredRejoinToken(sessionId);
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
          prefetch
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
      <header className="border-b border-border px-4 sm:px-6 py-4">
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

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
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

            <div className="grid w-full grid-cols-3 gap-4 sm:w-auto">
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
