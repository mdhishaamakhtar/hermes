"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface OptionResult {
  id: number;
  text: string;
  orderIndex: number;
  isCorrect: boolean;
  count: number;
}

interface QuestionResult {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  options: OptionResult[];
  totalAnswers: number;
}

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
}

interface SessionResults {
  sessionId: number;
  quizId: number;
  eventId: number;
  quizTitle: string;
  startedAt: string;
  endedAt: string;
  participantCount: number;
  leaderboard: LeaderboardEntry[];
  questions: QuestionResult[];
}

export default function ReviewClient({
  initialResults,
}: {
  initialResults: SessionResults;
}) {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "questions">(
    "leaderboard",
  );
  const [questionIndex, setQuestionIndex] = useState(0);

  const sortedQuestions = useMemo(
    () =>
      initialResults.questions.toSorted((a, b) => a.orderIndex - b.orderIndex),
    [initialResults.questions],
  );

  const currentQuestion = sortedQuestions[questionIndex];
  const maxCount = currentQuestion
    ? Math.max(...currentQuestion.options.map((option) => option.count), 1)
    : 1;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-2">
        <Link
          href={`/events/${initialResults.eventId}/quizzes/${initialResults.quizId}`}
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
          {initialResults.quizTitle}
        </h1>
        <div className="flex items-center gap-6 text-xs text-muted">
          <span className="tabular-nums">
            {initialResults.participantCount} participants
          </span>
          {initialResults.startedAt && (
            <span>
              {new Date(initialResults.startedAt).toLocaleDateString()}
            </span>
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
            {initialResults.leaderboard.length === 0 ? (
              <p className="text-center py-16 text-muted text-sm">
                No results yet.
              </p>
            ) : (
              <div className="space-y-px">
                {initialResults.leaderboard.map((entry, index) => (
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

        {activeTab === "questions" && currentQuestion && (
          <motion.div
            key="questions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() =>
                  setQuestionIndex((index) => Math.max(0, index - 1))
                }
                disabled={questionIndex === 0}
                className="label hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                ← Prev
              </button>
              <p className="label tabular-nums">
                {questionIndex + 1} / {sortedQuestions.length}
              </p>
              <button
                onClick={() =>
                  setQuestionIndex((index) =>
                    Math.min(sortedQuestions.length - 1, index + 1),
                  )
                }
                disabled={questionIndex >= sortedQuestions.length - 1}
                className="label hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Next →
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="border border-border bg-surface p-6"
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="label mb-2 tabular-nums">
                      Q{currentQuestion.orderIndex} ·{" "}
                      {currentQuestion.timeLimitSeconds}s
                    </p>
                    <h2 className="text-lg font-bold text-foreground leading-snug">
                      {currentQuestion.text}
                    </h2>
                  </div>
                  <span className="text-xs text-muted tabular-nums ml-4 shrink-0">
                    {currentQuestion.totalAnswers} answers
                  </span>
                </div>

                <div className="space-y-3">
                  {currentQuestion.options
                    .toSorted((a, b) => a.orderIndex - b.orderIndex)
                    .map((option) => {
                      const pct =
                        currentQuestion.totalAnswers > 0
                          ? Math.round(
                              (option.count / currentQuestion.totalAnswers) *
                                100,
                            )
                          : 0;
                      const barWidth =
                        maxCount > 0 ? (option.count / maxCount) * 100 : 0;

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
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-center gap-2 mt-6">
              {sortedQuestions.map((question, index) => (
                <button
                  key={question.id}
                  onClick={() => setQuestionIndex(index)}
                  aria-label={`Go to question ${index + 1}`}
                  className={`w-1.5 h-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    index === questionIndex
                      ? "bg-primary scale-125"
                      : "bg-border"
                  }`}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
