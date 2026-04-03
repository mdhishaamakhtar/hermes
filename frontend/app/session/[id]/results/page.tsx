"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import MinimalNav from "@/components/MinimalNav";
import Spinner from "@/components/Spinner";

interface QuestionResult {
  questionId: number;
  questionText: string;
  orderIndex: number;
  selectedOptionId: number | null;
  selectedOptionText: string | null;
  correctOptionId: number;
  correctOptionText: string;
  isCorrect: boolean;
  pointsEarned: number;
}

interface MyResults {
  displayName: string;
  rank: number;
  totalParticipants: number;
  score: number;
  correctCount: number;
  totalQuestions: number;
  questions: QuestionResult[];
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
      try {
        const res = await api.get<MyResults>(
          `/api/sessions/${sessionId}/my-results`,
          { "X-Rejoin-Token": rejoinToken },
        );
        if (res.success) setResults(res.data);
        else setError(res.error?.message || "Failed to load results");
      } catch {
        setError("Connection failed");
      }
    })();
  }, [sessionId]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <p className="label text-danger mb-6" role="alert">
          {error}
        </p>
        <Link
          href="/"
          prefetch
          className="label hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Go Home
        </Link>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const accuracy =
    results.totalQuestions > 0
      ? Math.round((results.correctCount / results.totalQuestions) * 100)
      : 0;

  return (
    <div className="scanlines min-h-screen bg-background flex flex-col">
      <MinimalNav />

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 relative z-10">
        {/* Hero score */}
        <div className="page-enter text-center mb-12">
          <p className="label mb-2">{results.displayName}</p>
          <div
            className="font-black tabular-nums text-foreground mb-1"
            style={{
              fontSize: "clamp(3rem, 8vw, 5rem)",
              lineHeight: 1,
            }}
          >
            {results.score.toLocaleString()}
          </div>
          <p className="label">points</p>

          <div className="flex items-center justify-center gap-8 mt-8">
            <div className="text-center">
              <p className="font-bold text-2xl text-foreground tabular-nums leading-none">
                #{results.rank}
              </p>
              <p className="label mt-0.5">of {results.totalParticipants}</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <p className="font-bold text-2xl text-foreground tabular-nums leading-none">
                {accuracy}%
              </p>
              <p className="label mt-0.5">accuracy</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <p className="font-bold text-2xl text-foreground tabular-nums leading-none">
                {results.correctCount}/{results.totalQuestions}
              </p>
              <p className="label mt-0.5">correct</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-border mb-8" />

        {/* Per-question breakdown */}
        <div className="space-y-2">
          {results.questions
            ?.toSorted((a, b) => a.orderIndex - b.orderIndex)
            .map((q, i) => (
              <div
                key={q.questionId}
                className={`page-enter border bg-surface p-6 ${
                  q.isCorrect ? "border-success/20" : "border-border"
                }`}
                style={{ animationDelay: `${Math.min(i, 5) * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-muted tabular-nums mt-0.5 shrink-0">
                      {q.orderIndex}.
                    </span>
                    <p className="text-sm md:text-base text-foreground">
                      {q.questionText}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {q.isCorrect ? (
                      <>
                        <span className="text-xs tabular-nums text-success">
                          +{q.pointsEarned}
                        </span>
                        <span className="text-success text-base">✓</span>
                      </>
                    ) : (
                      <span className="text-danger text-base">✗</span>
                    )}
                  </div>
                </div>

                <div className="ml-6 space-y-2">
                  {q.selectedOptionId !== null && !q.isCorrect && (
                    <div className="flex items-center gap-2">
                      <span className="label opacity-60 w-20 shrink-0">
                        Yours
                      </span>
                      <span className="text-xs text-danger line-through">
                        {q.selectedOptionText}
                      </span>
                    </div>
                  )}
                  {q.selectedOptionId === null && (
                    <div className="flex items-center gap-2">
                      <span className="label opacity-60 w-20 shrink-0">
                        Yours
                      </span>
                      <span className="text-xs text-muted/40 italic">
                        Not answered
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="label opacity-60 w-20 shrink-0">
                      Correct
                    </span>
                    <span className="text-xs text-success">
                      {q.correctOptionText}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>

        <div className="page-enter page-enter-delay-5 text-center mt-10">
          <Link
            href="/"
            prefetch
            className="label hover:text-foreground transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
