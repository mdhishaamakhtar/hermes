"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { ReviewSkeleton } from "@/components/PageSkeleton";
import BackLink from "@/components/ui/BackLink";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import LeaderboardRow from "@/components/ui/LeaderboardRow";
import { formatParticipantCount } from "@/lib/session-utils";
import type { SessionResults } from "@/lib/types";

export default function ReviewClient({ sessionId }: { sessionId: string }) {
  const {
    data: results,
    isLoading,
    error,
    mutate,
  } = useSWR<SessionResults>(`/api/sessions/${sessionId}/results`);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "questions">(
    "leaderboard",
  );

  const sortedQuestions = useMemo(
    () =>
      (results?.questions ?? []).toSorted(
        (a, b) => a.orderIndex - b.orderIndex,
      ),
    [results?.questions],
  );

  if (isLoading || (!results && !error)) return <ReviewSkeleton />;

  if (!results) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <BackLink href="/dashboard" label="Back to Dashboard" />
        <div className="mt-8 border border-border bg-surface p-8">
          <p className="label mb-3 text-warning">Review unavailable</p>
          <h1 className="text-2xl font-bold text-foreground">
            Final review is still loading
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            The session has ended, but the final review payload is not ready
            yet. Retry once the results snapshot finishes loading.
          </p>
          <div className="mt-6">
            <button onClick={() => void mutate()} className="btn-primary">
              Retry review
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
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
              {formatParticipantCount(results.participantCount)}
            </span>
            {results.startedAt && (
              <span>{new Date(results.startedAt).toLocaleDateString()}</span>
            )}
          </div>
        }
      />

      <section className="mb-8 border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="label mb-2">Ended session</p>
            <h2 className="text-2xl font-bold text-foreground">
              Final standings and question-by-question response shape
            </h2>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
            <div className="border border-border bg-background px-4 py-3">
              <p className="label mb-2">Question set</p>
              <p className="text-2xl font-black tabular-nums text-foreground">
                {sortedQuestions.length}
              </p>
              <p className="mt-1 text-xs text-muted">reviewed items</p>
            </div>
            <div className="border border-border bg-background px-4 py-3">
              <p className="label mb-2">Audience</p>
              <p className="text-2xl font-black tabular-nums text-foreground">
                {results.participantCount}
              </p>
              <p className="mt-1 text-xs text-muted">
                {formatParticipantCount(results.participantCount)}
              </p>
            </div>
          </div>
        </div>
      </section>

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
                  <div className="mb-6 flex items-start justify-between gap-6">
                    <div className="min-w-0">
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
                      {question.passageText ? (
                        <div className="mt-4 border border-border bg-background p-4">
                          <p className="label mb-3 text-warning">Passage</p>
                          <div
                            className="prose prose-invert max-w-none text-sm leading-7 text-muted prose-p:my-0 prose-p:leading-7"
                            dangerouslySetInnerHTML={{
                              __html: question.passageText,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      <p className="label mb-2">Responses</p>
                      <p className="text-lg font-bold tabular-nums text-foreground">
                        {question.totalAnswers}/{results.participantCount}
                      </p>
                      <p className="text-xs text-muted tabular-nums">
                        {results.participantCount > 0
                          ? `${Math.round(
                              (question.totalAnswers /
                                results.participantCount) *
                                100,
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
