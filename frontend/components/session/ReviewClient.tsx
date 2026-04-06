"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ReviewSkeleton } from "@/components/PageSkeleton";
import BackLink from "@/components/ui/BackLink";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import LeaderboardRow from "@/components/ui/LeaderboardRow";
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
      <BackLink
        href={`/events/${results.eventId}/quizzes/${results.quizId}`}
        label="Back to Quiz"
      />

      <PageHeader
        label="Session Review"
        title={results.quizTitle}
        meta={
          <div className="flex items-center gap-6 text-xs text-muted">
            <span className="tabular-nums">
              {results.participantCount} participants
            </span>
            {results.startedAt && (
              <span>{new Date(results.startedAt).toLocaleDateString()}</span>
            )}
          </div>
        }
      />

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
              <EmptyState message="No results yet." />
            ) : (
              <div className="space-y-2">
                {results.leaderboard.map((entry, index) => (
                  <LeaderboardRow
                    key={`${entry.rank}-${entry.displayName}`}
                    rank={entry.rank}
                    displayName={entry.displayName}
                    score={entry.score}
                    variant="review"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.04 }}
                  />
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
