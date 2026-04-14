"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CardBadge } from "@/components/session/CardBadge";
import { LiveParticipantCount } from "@/components/session/LiveParticipantCount";
import { ScoringDrawer } from "@/components/session/ScoringDrawer";
import { QuestionCard } from "@/components/session/QuestionCard";
import Logo from "@/components/Logo";
import LeaderboardRow from "@/components/ui/LeaderboardRow";
import { formatParticipantCountPhrase } from "@/lib/session-utils";
import { enterAnimation } from "@/lib/design-tokens";
import type { SessionResults } from "@/lib/types";
import {
  buildResultsQuestionCard,
  useHostSession,
} from "@/features/session/host/useHostSession";

interface Props {
  id: string;
  session: ReturnType<typeof useHostSession>;
}

export function HostEndedView({ id, session }: Props) {
  const {
    participantCount,
    leaderboard,
    finalLeaderboard,
    sessionResults,
    drawerSaving,
    scoringQuestionId,
    scoringQuestionTitle,
    scoringDraft,
    scoringError,
    setScoringDraft,
    activeModeLabel,
    openScoringDrawer,
    closeDrawer,
    handleSaveScoring,
  } = session;

  const leaderboardRows = finalLeaderboard ?? leaderboard;
  const quizHref = sessionResults
    ? `/events/${sessionResults.eventId}/quizzes/${sessionResults.quizId}`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 sm:px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <CardBadge tone="muted">Ended</CardBadge>
            <LiveParticipantCount
              count={participantCount}
              caption={formatParticipantCountPhrase(participantCount)}
              size="sm"
              layout="inline"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:px-6 py-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          <motion.div
            {...enterAnimation}
            className="border border-border bg-surface p-6"
          >
            <p className="label mb-2">Session complete</p>
            <h1 className="text-3xl font-bold text-foreground">Final review</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted">
              Session results are locked, but scoring corrections are still
              available. Open any question and update its point values to
              recalculate the leaderboard.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {quizHref ? (
                <Link
                  href={quizHref}
                  prefetch
                  className="border border-border px-4 py-3 text-xs tracking-widest uppercase text-muted transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  Back to Quiz
                </Link>
              ) : null}
              <Link
                href={`/session/${id}/review`}
                prefetch
                className="btn-primary"
              >
                Full Review
              </Link>
            </div>
          </motion.div>

          <div className="space-y-4">
            {!sessionResults?.questions?.length ? (
              <div className="border border-border bg-surface p-6 text-sm text-muted">
                Loading results...
              </div>
            ) : (
              (() => {
                type ResultQuestion = SessionResults["questions"][number];
                type ReviewGroup =
                  | { type: "standalone"; question: ResultQuestion }
                  | {
                      type: "passage";
                      passageId: number;
                      questions: ResultQuestion[];
                    };
                const sorted = sessionResults.questions.toSorted(
                  (a, b) => a.orderIndex - b.orderIndex,
                );
                const groups: ReviewGroup[] = [];
                let currentPassageId: number | null = null;
                let currentGroup: Extract<
                  ReviewGroup,
                  { type: "passage" }
                > | null = null;
                for (const q of sorted) {
                  if (q.passageId == null) {
                    groups.push({ type: "standalone", question: q });
                    currentPassageId = null;
                    currentGroup = null;
                  } else if (q.passageId === currentPassageId && currentGroup) {
                    currentGroup.questions.push(q);
                  } else {
                    currentPassageId = q.passageId;
                    currentGroup = {
                      type: "passage",
                      passageId: q.passageId,
                      questions: [q],
                    };
                    groups.push(currentGroup);
                  }
                }
                return groups.map((group, gIdx) => {
                  if (group.type === "standalone") {
                    const card = buildResultsQuestionCard(group.question);
                    return (
                      <motion.div
                        key={`q-${group.question.id}`}
                        {...enterAnimation}
                        transition={{
                          ...enterAnimation.transition,
                          delay: gIdx * 0.03,
                        }}
                      >
                        <QuestionCard
                          question={card}
                          mode="review"
                          onEdit={() => openScoringDrawer(card)}
                        />
                      </motion.div>
                    );
                  }
                  const passageHtml = group.questions[0]?.passageText ?? "";
                  return (
                    <motion.div
                      key={`p-${group.passageId}`}
                      {...enterAnimation}
                      transition={{
                        ...enterAnimation.transition,
                        delay: gIdx * 0.03,
                      }}
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
                            __html: passageHtml,
                          }}
                        />
                      </div>
                      <div className="divide-y divide-border/50">
                        {group.questions.map((q) => {
                          const card = buildResultsQuestionCard(q);
                          return (
                            <QuestionCard
                              key={`q-${q.id}`}
                              question={card}
                              mode="review"
                              onEdit={() => openScoringDrawer(card)}
                            />
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                });
              })()
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <section className="border border-border bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="label">Leaderboard</span>
              <span className="text-xs text-muted tabular-nums">
                {leaderboardRows.length} shown
              </span>
            </div>
            <div className="space-y-2">
              {leaderboardRows.length === 0 ? (
                <p className="text-sm text-muted">No leaderboard data yet.</p>
              ) : (
                leaderboardRows.map((entry, index) => (
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
                ))
              )}
            </div>
          </section>

          <section className="border border-border bg-surface p-6">
            <p className="label mb-3">Session</p>
            <div className="space-y-3 text-sm text-muted">
              <div className="flex items-center justify-between gap-4">
                <span>Status</span>
                <span className="text-foreground">ENDED</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Display mode</span>
                <span className="text-foreground">{activeModeLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Participants</span>
                <span className="text-foreground tabular-nums">
                  {participantCount}
                </span>
              </div>
            </div>
          </section>

          <div className="flex gap-3">
            <Link
              href={`/session/${id}/review`}
              prefetch
              className="btn-primary flex-1 text-center"
            >
              Full Review
            </Link>
          </div>
        </aside>
      </main>

      <ScoringDrawer
        open={scoringQuestionId !== null}
        questionTitle={scoringQuestionTitle}
        draftOptions={scoringDraft}
        saving={drawerSaving}
        error={scoringError}
        onClose={closeDrawer}
        onChange={(index, value) =>
          setScoringDraft((current) =>
            current.map((option, optionIndex) =>
              optionIndex === index ? { ...option, pointValue: value } : option,
            ),
          )
        }
        onSave={handleSaveScoring}
      />
    </div>
  );
}
