"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import Logo from "@/components/Logo";
import { SessionPageSkeleton } from "@/components/PageSkeleton";
import LeaderboardRow from "@/components/ui/LeaderboardRow";
import { LockInPendingOverlay } from "@/components/session/LockInPendingOverlay";
import { ParticipantQuestionCard } from "@/components/session/ParticipantQuestionCard";
import { LiveParticipantCount } from "@/components/session/LiveParticipantCount";
import { enterAnimation } from "@/lib/design-tokens";
import {
  formatCountdownClock,
  formatParticipantCountPhrase,
} from "@/lib/session-utils";
import {
  formatQuestionSpanLabel,
  sumVisibleQuestionsPoints,
  usePlaySession,
} from "@/features/session/play/usePlaySession";

export default function PlayPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const {
    sessionState,
    questionLifecycle,
    sessionTitle,
    participantCount,
    participantId,
    timeLeft,
    syncStatus,
    syncMessage,
    hydrated,
    activePassage,
    activeQuestions,
    isPassage,
    maxQuestionIndex,
    selectedQuestionCount,
    timerColour,
    myLeaderboardEntry,
    topFive,
    leaderboardRows,
    lockableQuestions,
    canLockAll,
    anyLockInPending,
    lockInPendingByQuestionId,
    timerBarLimitSeconds,
    handleToggleOption,
    handleLockIn,
    handleLockAll,
    handleLeave,
  } = usePlaySession(sessionId);

  if (!hydrated) return <SessionPageSkeleton />;

  if (sessionState === "LOBBY") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-4 sm:px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Logo size="sm" />
            <div className="flex items-center gap-3">
              <span className="label text-warning">Lobby</span>
              <LiveParticipantCount
                count={participantCount}
                caption={formatParticipantCountPhrase(participantCount)}
                size="sm"
                layout="inline"
              />
            </div>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl items-center justify-center px-4 sm:px-6 py-10">
          <motion.div
            {...enterAnimation}
            className="w-full border border-border bg-surface px-8 py-10 text-center"
          >
            <p className="label mb-4">{sessionTitle}</p>
            <h1 className="text-3xl font-bold text-foreground">
              Waiting for the host
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted">
              The room is open and your connection is ready. When the host
              starts the timer, the first question will slide into place here.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3">
              <span className="label text-accent">Live session</span>
              <LiveParticipantCount
                count={participantCount}
                caption="joined"
                size="lg"
                layout="stack"
                className="w-full max-w-xs"
              />
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  if (sessionState === "ENDED") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
        <div className="flex items-center gap-2">
          {([0, 0.15, 0.3] as const).map((delay, i) => (
            <span
              key={i}
              className="live-dot h-1.5 w-1.5 rounded-full bg-accent"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </div>
        <p className="label text-muted">Session ended</p>
      </div>
    );
  }

  const currentQuestionsLabel = activeQuestions[0]
    ? formatQuestionSpanLabel(
        activeQuestions[0].questionIndex,
        activeQuestions.length > 1 &&
          activePassage?.timerMode === "ENTIRE_PASSAGE"
          ? maxQuestionIndex
          : activeQuestions[0].questionIndex,
        activeQuestions[0].totalQuestions,
      )
    : "Waiting";

  const headerStatus =
    questionLifecycle === "DISPLAYED"
      ? "Read-only"
      : questionLifecycle === "TIMED"
        ? "Answer now"
        : questionLifecycle === "FROZEN"
          ? "Frozen"
          : "Review";

  const focusedScore =
    questionLifecycle === "REVIEWING" && activeQuestions.length > 0
      ? sumVisibleQuestionsPoints(activeQuestions)
      : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-4">
          <Logo size="sm" />
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
            <span className="label">{headerStatus}</span>
            <LiveParticipantCount
              count={participantCount}
              caption={formatParticipantCountPhrase(participantCount)}
              size="sm"
              layout="inline"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:px-6 py-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          {/* Plain section: Framer enterAnimation on a parent applies transform and breaks %-width timer fills */}
          <section className="border border-border bg-surface p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="label tabular-nums">
                {currentQuestionsLabel}
              </span>
              <span className="text-xs text-muted/40">·</span>
              <span className="label text-accent">{headerStatus}</span>
              {isPassage ? (
                <>
                  <span className="text-xs text-muted/40">·</span>
                  <span className="label text-warning">Passage</span>
                </>
              ) : null}
            </div>

            {questionLifecycle === "TIMED" ? (
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="label mb-2">Timer</p>
                  <div
                    className="font-black tabular-nums"
                    style={{
                      fontSize: "clamp(2.2rem, 8vw, 4.5rem)",
                      lineHeight: 1,
                      color: timerColour,
                    }}
                  >
                    {formatCountdownClock(timeLeft, questionLifecycle)}
                  </div>
                </div>
                <div className="min-w-0 w-full max-w-sm shrink">
                  <div className="h-1 overflow-hidden bg-border">
                    <motion.div
                      key={`${questionLifecycle}-${timerBarLimitSeconds}`}
                      className="h-full max-w-full"
                      initial={false}
                      animate={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            timeLeft !== null && timerBarLimitSeconds > 0
                              ? (timeLeft / timerBarLimitSeconds) * 100
                              : 0,
                          ),
                        )}%`,
                      }}
                      transition={{ duration: 1, ease: "linear" }}
                      style={{ backgroundColor: timerColour }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <span className="label text-muted">
                  {questionLifecycle === "DISPLAYED"
                    ? "Awaiting timer"
                    : questionLifecycle === "FROZEN"
                      ? "Time\u2019s up"
                      : "Reviewing"}
                </span>
              </div>
            )}
          </section>

          {activePassage ? (
            <motion.section
              {...enterAnimation}
              className="border border-border bg-surface p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="label">Passage</p>
                    <span className="text-xs text-muted/40">·</span>
                    <span className="text-xs text-muted tabular-nums">
                      Q{activePassage.questionIndex}
                      {maxQuestionIndex > activePassage.questionIndex
                        ? `-Q${maxQuestionIndex}`
                        : ""}{" "}
                      of {activePassage.totalQuestions}
                    </span>
                    <span className="text-xs text-muted/40">·</span>
                    <span className="text-xs text-muted">
                      {activePassage.timerMode === "ENTIRE_PASSAGE"
                        ? "All sub-questions together"
                        : "Passage stays pinned"}
                    </span>
                  </div>
                  <div
                    className="prose prose-invert max-w-4xl text-lg leading-relaxed text-foreground prose-p:my-0 prose-p:leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: activePassage.text }}
                  />
                </div>
              </div>
            </motion.section>
          ) : null}

          {activeQuestions.length > 1 &&
          activePassage?.timerMode === "ENTIRE_PASSAGE" ? (
            <div className="grid gap-4">
              {activeQuestions.map((question, index) => (
                <motion.div
                  key={question.id}
                  {...enterAnimation}
                  transition={{
                    ...enterAnimation.transition,
                    delay: index * 0.03,
                  }}
                >
                  <ParticipantQuestionCard
                    question={question}
                    lifecycle={questionLifecycle}
                    lockInPending={Boolean(
                      lockInPendingByQuestionId[question.id],
                    )}
                    onToggleOption={handleToggleOption}
                    onLockIn={handleLockIn}
                  />
                </motion.div>
              ))}
            </div>
          ) : activeQuestions[0] ? (
            <motion.div {...enterAnimation}>
              <ParticipantQuestionCard
                question={activeQuestions[0]}
                lifecycle={questionLifecycle}
                lockInPending={Boolean(
                  lockInPendingByQuestionId[activeQuestions[0].id],
                )}
                onToggleOption={handleToggleOption}
                onLockIn={handleLockIn}
              />
            </motion.div>
          ) : (
            <motion.section
              {...enterAnimation}
              className="border border-border bg-surface p-8"
            >
              <p className="label mb-3">Waiting</p>
              <h2 className="text-2xl font-bold text-foreground">
                Waiting for the next question
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                The session is live, but the next question has not been
                delivered yet.
              </p>
            </motion.section>
          )}

          <motion.section
            {...enterAnimation}
            className="border border-border bg-surface p-4 sm:p-6"
          >
            <div className="hidden sm:flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="label mb-2">Answer state</p>
                <h3 className="text-xl font-bold text-foreground">
                  {questionLifecycle === "DISPLAYED"
                    ? "Read the question"
                    : questionLifecycle === "TIMED"
                      ? "Change your answer freely"
                      : questionLifecycle === "FROZEN"
                        ? "Answers locked"
                        : "Results revealed"}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className="tabular-nums">
                  {selectedQuestionCount} ready
                </span>
                <span className="text-muted/40">·</span>
                <span className="tabular-nums">
                  {activeQuestions.length} visible
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-3 sm:mt-4">
              {questionLifecycle === "TIMED" ? (
                <>
                  <button
                    type="button"
                    onClick={handleLockAll}
                    disabled={!canLockAll || anyLockInPending}
                    className={`relative overflow-hidden btn-primary ${anyLockInPending ? "btn-lock-in-pending" : ""}`}
                  >
                    {anyLockInPending ? (
                      <LockInPendingOverlay tone="primary" />
                    ) : null}
                    <span className="relative z-[var(--z-raised)]">
                      {anyLockInPending
                        ? "Locking…"
                        : activePassage?.timerMode === "ENTIRE_PASSAGE"
                          ? "Lock In All"
                          : "Lock In"}
                    </span>
                  </button>
                  <p className="text-xs text-muted">
                    {activePassage?.timerMode === "ENTIRE_PASSAGE"
                      ? `${lockableQuestions.length} question(s) ready to freeze`
                      : "You can keep changing your choice until you lock it."}
                  </p>
                </>
              ) : questionLifecycle === "REVIEWING" ? (
                <p className="text-xs text-muted">
                  {focusedScore !== null
                    ? activeQuestions.length > 1
                      ? `You scored ${focusedScore} points across these questions.`
                      : `You scored ${focusedScore} points on this question.`
                    : "Scores are being recalculated."}
                </p>
              ) : (
                <p className="text-xs text-muted">
                  {questionLifecycle === "DISPLAYED"
                    ? "The host has not started the timer yet."
                    : "The timer expired and grading is underway."}
                </p>
              )}
            </div>
            {syncStatus !== "idle" || syncMessage ? (
              <p
                className={`mt-3 text-xs ${
                  syncStatus === "error" ? "text-danger" : "text-muted"
                }`}
              >
                {syncMessage}
              </p>
            ) : null}
          </motion.section>
        </div>

        <aside className="space-y-6">
          <motion.section
            {...enterAnimation}
            className="border border-border bg-surface p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="label mb-2">Leaderboard</p>
                <h3 className="text-lg font-bold text-foreground">
                  Top 5 and your rank
                </h3>
              </div>
              <span className="text-xs text-muted tabular-nums">
                {leaderboardRows.length
                  ? `${leaderboardRows.length} shown`
                  : "Waiting"}
              </span>
            </div>

            <div className="space-y-2">
              {topFive.length === 0 ? (
                <p className="text-sm text-muted">
                  Leaderboard will appear after review.
                </p>
              ) : (
                topFive.map((entry, index) => (
                  <LeaderboardRow
                    key={`${entry.rank}-${entry.displayName}`}
                    rank={entry.rank}
                    displayName={entry.displayName}
                    score={entry.score}
                    variant="review"
                    isMe={entry.participantId === participantId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.04 }}
                  />
                ))
              )}
            </div>

            {myLeaderboardEntry ? (
              <div className="mt-4 border border-border bg-background p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="label">You</span>
                  <span className="text-xs text-muted tabular-nums">
                    #{myLeaderboardEntry.rank}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">
                    {myLeaderboardEntry.displayName}
                  </span>
                  <span className="font-bold tabular-nums text-foreground">
                    {myLeaderboardEntry.score.toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 border border-border bg-background p-4 text-sm text-muted">
                Your rank will appear after the current question is reviewed.
              </div>
            )}
          </motion.section>

          <motion.section
            {...enterAnimation}
            className="hidden xl:block border border-border bg-surface p-6"
          >
            <p className="label mb-4">Session details</p>
            <div className="space-y-3 text-sm text-muted">
              <div className="flex items-center justify-between gap-4">
                <span>Status</span>
                <span className="text-foreground">{sessionState}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Lifecycle</span>
                <span className="text-foreground">{questionLifecycle}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Question set</span>
                <span className="text-foreground tabular-nums">
                  {activeQuestions.length}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Timer</span>
                <span className="text-foreground tabular-nums">
                  {formatCountdownClock(timeLeft, questionLifecycle)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Participants</span>
                <span className="text-foreground tabular-nums">
                  {participantCount}
                </span>
              </div>
            </div>
          </motion.section>

          {questionLifecycle === "REVIEWING" && activeQuestions[0] ? (
            <motion.section
              {...enterAnimation}
              className="border border-border bg-surface p-6"
            >
              <p className="label mb-4">Question score</p>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div
                    className="font-black tabular-nums text-foreground"
                    style={{
                      fontSize: "clamp(2.25rem, 8vw, 3.75rem)",
                      lineHeight: 1,
                    }}
                  >
                    {sumVisibleQuestionsPoints(
                      activeQuestions,
                    ).toLocaleString()}
                  </div>
                  <p className="mt-2 text-xs text-muted">Points earned</p>
                </div>
                <span className="label text-success">
                  {activeQuestions.every((q) => q.reviewed)
                    ? "Reviewed"
                    : "Pending"}
                </span>
              </div>
            </motion.section>
          ) : null}

          <div className="flex gap-3">
            <Link
              href="/"
              prefetch
              onClick={handleLeave}
              className="block w-full border border-border px-5 py-3 text-center text-xs tracking-widest uppercase text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Leave session
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
