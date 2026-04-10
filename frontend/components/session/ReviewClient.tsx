"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { ReviewSkeleton } from "@/components/PageSkeleton";
import BackLink from "@/components/ui/BackLink";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import LeaderboardRow from "@/components/ui/LeaderboardRow";
import { QuestionReviewCard } from "@/components/session/QuestionReviewCard";
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

      <section className="mb-8 border border-border bg-surface px-6 py-5">
        <p className="label mb-2">Ended session</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="max-w-2xl text-2xl font-bold text-foreground">
            Final standings and response shape
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="tabular-nums">
              {sortedQuestions.length} questions
            </span>
            <span className="text-muted/40">·</span>
            <span className="tabular-nums">
              {formatParticipantCount(results.participantCount)}
            </span>
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
            className="space-y-8"
          >
            {(() => {
              const groups: (
                | {
                    type: "standalone";
                    question: (typeof sortedQuestions)[number];
                  }
                | {
                    type: "passage";
                    passageId: number;
                    passageText: string;
                    questions: typeof sortedQuestions;
                  }
              )[] = [];

              let currentPassageId: number | null = null;
              let currentPassageGroup: {
                type: "passage";
                passageId: number;
                passageText: string;
                questions: typeof sortedQuestions;
              } | null = null;

              for (const q of sortedQuestions) {
                if (q.passageId == null) {
                  groups.push({ type: "standalone", question: q });
                  currentPassageId = null;
                  currentPassageGroup = null;
                } else if (
                  q.passageId === currentPassageId &&
                  currentPassageGroup
                ) {
                  currentPassageGroup.questions.push(q);
                } else {
                  currentPassageId = q.passageId;
                  currentPassageGroup = {
                    type: "passage",
                    passageId: q.passageId,
                    passageText: q.passageText || "",
                    questions: [q],
                  };
                  groups.push(currentPassageGroup);
                }
              }

              return groups.map((group) => {
                if (group.type === "standalone") {
                  return (
                    <QuestionReviewCard
                      key={`q-${group.question.id}`}
                      question={group.question}
                      participantCount={results.participantCount}
                    />
                  );
                }

                return (
                  <div
                    key={`p-${group.passageId}`}
                    className="border border-border bg-surface overflow-hidden"
                  >
                    <div className="bg-background/50 border-b border-border p-6 pb-8">
                      <div className="mb-4 flex items-center gap-2">
                        <span className="label text-warning">Passage</span>
                        <span className="text-muted/40 text-xs">·</span>
                        <span className="text-xs text-muted">
                          {group.questions.length} questions
                        </span>
                      </div>
                      <div
                        className="prose prose-invert max-w-none text-base leading-relaxed text-foreground prose-p:my-0 prose-p:leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: group.passageText,
                        }}
                      />
                    </div>
                    <div className="divide-y divide-border/50">
                      {group.questions.map((q) => (
                        <QuestionReviewCard
                          key={`q-${q.id}`}
                          question={q}
                          participantCount={results.participantCount}
                          isInsidePassage
                        />
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
