"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ReviewSkeleton } from "@/components/PageSkeleton";
import type { SessionResults } from "@/lib/types";

export default function ReviewClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const {
    data: results,
    isLoading,
    error,
  } = useSWR<SessionResults>(`/api/sessions/${sessionId}/results`);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "questions">(
    "leaderboard",
  );

  useEffect(() => {
    if (error) router.push("/dashboard");
  }, [error, router]);

  const sortedQuestions = useMemo(
    () =>
      (results?.questions ?? []).toSorted(
        (a, b) => a.orderIndex - b.orderIndex,
      ),
    [results?.questions],
  );

  if (isLoading || !results) return <ReviewSkeleton />;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-2">
        <Link
          href={`/events/${results.eventId}/quizzes/${results.quizId}`}
          prefetch
          className="label hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ← Back to Quiz
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-10"
      >
        <p className="label mb-1">Session Review</p>
        <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">
          {results.quizTitle}
        </h1>
        <div className="flex items-center gap-6 text-xs text-muted">
          <span className="tabular-nums">
            {results.participantCount} participants
          </span>
          {results.startedAt && (
            <span>{new Date(results.startedAt).toLocaleDateString()}</span>
          )}
        </div>
      </motion.div>

      <div className="flex gap-0 mb-8 border-b border-border">
        {(["leaderboard", "questions"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-4 text-xs tracking-widest uppercase transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
              activeTab === tab
                ? "text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab === "leaderboard" ? "Leaderboard" : "Questions"}
            {activeTab === tab && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-px bg-primary"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "leaderboard" && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {results.leaderboard.length === 0 ? (
              <p className="text-center py-16 text-muted text-sm">
                No results yet.
              </p>
            ) : (
              <div className="space-y-px">
                {results.leaderboard.map((entry, index) => (
                  <motion.div
                    key={`${entry.rank}-${entry.displayName}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.04 }}
                    className={`flex items-center justify-between px-6 py-4 bg-surface border ${
                      entry.rank === 1 ? "border-primary/40" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <span
                        className={`font-bold tabular-nums text-lg w-8 ${
                          entry.rank === 1
                            ? "text-accent"
                            : entry.rank <= 3
                              ? "text-muted"
                              : "text-muted/40"
                        }`}
                      >
                        {entry.rank}
                      </span>
                      <span
                        className={`font-medium text-sm ${
                          entry.rank === 1 ? "text-foreground" : "text-muted"
                        }`}
                      >
                        {entry.displayName}
                      </span>
                    </div>
                    <span className="font-bold tabular-nums text-foreground">
                      {entry.score.toLocaleString()}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "questions" && (
          <motion.div
            key="questions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {sortedQuestions.map((question) => {
              const maxCount = Math.max(
                ...question.options.map((o) => o.count),
                1,
              );
              return (
                <div
                  key={question.id}
                  className="border border-border bg-surface p-6"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="label tabular-nums">
                          Q{question.orderIndex}
                        </p>
                        <span className="text-muted/40 text-xs">·</span>
                        <span className="text-xs text-muted tabular-nums">
                          {question.timeLimitSeconds}s time limit
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-foreground leading-snug">
                        {question.text}
                      </h2>
                    </div>
                    <span className="text-xs text-muted tabular-nums ml-4 shrink-0">
                      {question.totalAnswers}{" "}
                      {question.totalAnswers === 1 ? "answer" : "answers"}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {question.options
                      .toSorted((a, b) => a.orderIndex - b.orderIndex)
                      .map((option) => {
                        const pct =
                          question.totalAnswers > 0
                            ? Math.round(
                                (option.count / question.totalAnswers) * 100,
                              )
                            : 0;
                        const barWidth = (option.count / maxCount) * 100;

                        return (
                          <div key={option.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-sm ${
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
                              <span className="text-xs tabular-nums text-muted">
                                {option.count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-border overflow-hidden relative">
                              <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: barWidth / 100 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 300,
                                  damping: 32,
                                }}
                                className="h-full absolute inset-0 origin-left"
                                style={{
                                  background: option.isCorrect
                                    ? "var(--color-success)"
                                    : "var(--color-primary)",
                                  boxShadow: option.isCorrect
                                    ? "0 0 8px rgba(34,197,94,0.4)"
                                    : "none",
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
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
