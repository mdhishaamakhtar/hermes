"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { LeaderboardEntry, SessionResults } from "../session-types";
import { QuestionBreakdown, ResultGroups } from "./Breakdown";
import { FinalStandings } from "./Leaderboard";
import { ScoringDrawer, type ScoringTarget } from "./ScoringDrawer";

/**
 * A finished session, for its organiser: the final standings beside every
 * question's answer spread. A question graded wrongly can be re-scored here,
 * and the standings recalculate.
 */
export function WrapUp({
  results,
  leaderboard,
  onCorrectScoring,
}: {
  results: SessionResults | null;
  /** Standings known before the full results load (the live host view). */
  leaderboard?: LeaderboardEntry[];
  onCorrectScoring: (
    questionId: number,
    points: Array<{ optionId: number; pointValue: number }>,
  ) => Promise<void>;
}) {
  const [target, setTarget] = useState<ScoringTarget | null>(null);
  const [open, setOpen] = useState(false);
  const standings = results?.leaderboard ?? leaderboard ?? [];

  return (
    <div className="grid gap-10 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <section aria-labelledby="final-heading">
        <h2
          id="final-heading"
          className="mb-4 text-xl font-semibold text-foreground"
        >
          Final standings
        </h2>
        <FinalStandings entries={standings} />
      </section>

      <section aria-labelledby="breakdown-heading" className="min-w-0">
        <h2
          id="breakdown-heading"
          className="mb-1 text-xl font-semibold text-foreground"
        >
          Questions
        </h2>
        <p className="mb-4 text-sm text-subtle">
          Graded a question wrongly? Edit its scoring and the standings
          recalculate.
        </p>
        {results ? (
          <ResultGroups
            questions={results.questions}
            getKey={(question) => question.id}
            renderQuestion={(question) => (
              <QuestionBreakdown
                question={question}
                participantCount={results.participantCount}
                onEditScoring={() => {
                  setTarget({
                    questionId: question.id,
                    number: question.orderIndex,
                    text: question.text,
                    options: question.options.toSorted(
                      (a, b) => a.orderIndex - b.orderIndex,
                    ),
                  });
                  setOpen(true);
                }}
              />
            )}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {[0, 1].map((block) => (
              <Skeleton key={block} className="h-64" />
            ))}
          </div>
        )}
      </section>

      <ScoringDrawer
        open={open}
        target={target}
        onClose={() => setOpen(false)}
        onSave={onCorrectScoring}
      />
    </div>
  );
}
