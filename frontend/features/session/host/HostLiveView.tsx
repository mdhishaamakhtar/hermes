"use client";

import { AnimatePresence, motion } from "framer-motion";
import Logo from "@/components/Logo";
import LeaderboardRow from "@/components/ui/LeaderboardRow";
import { CardBadge } from "@/components/session/CardBadge";
import { ConnectionStatusBadge } from "@/components/session/ConnectionStatusBadge";
import { QuestionCard } from "@/components/session/QuestionCard";
import { ScoringDrawer } from "@/components/session/ScoringDrawer";
import { LiveParticipantCount } from "@/components/session/LiveParticipantCount";
import {
  formatCountdownClock,
  formatParticipantCountPhrase,
} from "@/lib/session-utils";
import { enterAnimation } from "@/lib/design-tokens";
import { buildActiveQuestionCard, useHostSession } from "./useHostSession";

interface Props {
  session: ReturnType<typeof useHostSession>;
}

export function HostLiveView({ session }: Props) {
  const {
    sessionStatus,
    questionLifecycle,
    joinCode,
    participantCount,
    activePassage,
    effectiveDisplayMode,
    timeLeft,
    questionStatsById,
    leaderboard,
    finalLeaderboard,
    copied,
    loadingAction,
    drawerSaving,
    scoringQuestionId,
    scoringQuestionTitle,
    scoringDraft,
    scoringError,
    setScoringDraft,
    currentQuestions,
    primaryQuestion,
    currentQuestionStats,
    canAdvance,
    timerColour,
    timerPct,
    openScoringDrawer,
    closeDrawer,
    handleStartTimer,
    handleEndTimerEarly,
    handleNextQuestion,
    handleForceEnd,
    handleCopyCode,
    handleSaveScoring,
    activeModeLabel,
    progressLabel,
    isLastQuestion,
    connected,
  } = session;

  const isTimedSummary =
    questionLifecycle === "TIMED" && effectiveDisplayMode !== "LIVE";
  const isTimedLive =
    questionLifecycle === "TIMED" && effectiveDisplayMode === "LIVE";
  const isCodeDisplay =
    questionLifecycle === "TIMED" && effectiveDisplayMode === "CODE_DISPLAY";
  const isReviewing = questionLifecycle === "REVIEWING";

  const stageMode = isReviewing
    ? "review"
    : isTimedLive
      ? "timed-live"
      : isTimedSummary || questionLifecycle === "FROZEN" || isCodeDisplay
        ? "timed-summary"
        : "display";

  const passageBannerText = activePassage?.text ?? null;

  const activeLeaderboard = leaderboard.length
    ? leaderboard
    : (finalLeaderboard ?? []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-4">
          <Logo size="sm" />
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
            <CardBadge
              tone={sessionStatus === "ACTIVE" ? "success" : "warning"}
            >
              {sessionStatus}
            </CardBadge>
            <ConnectionStatusBadge connected={connected} />
            <CardBadge tone="accent" className="hidden sm:inline-flex">
              {questionLifecycle}
            </CardBadge>
            <LiveParticipantCount
              count={participantCount}
              caption={formatParticipantCountPhrase(participantCount)}
              size="sm"
              layout="inline"
            />
            <button
              onClick={handleCopyCode}
              disabled={!joinCode}
              className="border border-border px-3 py-3 text-xs tracking-widest uppercase text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="hidden sm:inline">
                {copied ? "Copied" : joinCode || "Copy code"}
              </span>
              <span className="sm:hidden">{copied ? "Copied" : "Code"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:px-6 py-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          <motion.section
            {...enterAnimation}
            className="border border-border bg-surface p-6"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="label tabular-nums">{progressLabel}</span>
              <span className="text-xs text-muted/50">·</span>
              <span className="label text-accent">{activeModeLabel}</span>
              {passageBannerText ? (
                <>
                  <span className="text-xs text-muted/50">·</span>
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
                      fontSize: "clamp(2rem, 7vw, 4rem)",
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
                      className="h-full max-w-full"
                      initial={false}
                      animate={{
                        width: `${Math.max(0, Math.min(100, timerPct))}%`,
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
          </motion.section>

          {/* Mobile-only session controls — shown above question so host doesn't have to scroll */}
          <div className="xl:hidden border border-border bg-surface p-4 sm:p-6 space-y-3">
            {questionLifecycle === "DISPLAYED" ? (
              <button
                onClick={handleStartTimer}
                disabled={loadingAction === "start-timer"}
                className="btn-primary w-full"
              >
                {loadingAction === "start-timer"
                  ? "Starting timer..."
                  : "Start Timer"}
              </button>
            ) : null}

            {questionLifecycle === "TIMED" ? (
              <button
                onClick={handleEndTimerEarly}
                disabled={loadingAction === "end-timer"}
                className="btn-primary w-full"
              >
                {loadingAction === "end-timer"
                  ? "Freezing..."
                  : "End Timer Early"}
              </button>
            ) : null}

            {questionLifecycle === "REVIEWING" ? (
              <button
                onClick={handleNextQuestion}
                disabled={!canAdvance || loadingAction === "next"}
                className="btn-primary w-full"
              >
                {loadingAction === "next"
                  ? "Advancing..."
                  : canAdvance
                    ? isLastQuestion
                      ? "Finish quiz"
                      : "Next question"
                    : "Waiting for review"}
              </button>
            ) : null}

            <button
              onClick={handleForceEnd}
              disabled={loadingAction === "end-session"}
              className="w-full border border-border px-5 py-3 text-xs tracking-widest uppercase text-muted transition-colors hover:border-danger/50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loadingAction === "end-session" ? "Ending..." : "Force End"}
            </button>
          </div>

          {isCodeDisplay ? (
            <motion.section
              {...enterAnimation}
              className="border border-border bg-surface p-6"
            >
              {/* Join code — compact inline bar */}
              <div className="mb-5 flex items-center gap-4 border border-primary/20 bg-background px-5 py-3">
                <span className="label shrink-0">Join</span>
                <span
                  className="select-all font-black tracking-[0.3em] text-foreground"
                  style={{ fontSize: "clamp(1.5rem, 4vw, 2.5rem)" }}
                >
                  {joinCode || "------"}
                </span>
              </div>

              {/* Question / passage text — full width, scrollable */}
              <div className="border border-border bg-background p-5">
                {activePassage?.timerMode === "ENTIRE_PASSAGE" ? (
                  <>
                    <p className="label mb-3 text-warning">Passage</p>
                    <div className="max-h-[40vh] overflow-y-auto pr-2">
                      <p className="whitespace-pre-wrap text-base leading-relaxed text-muted">
                        {activePassage.text}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="label mb-3">Prompt</p>
                    <h2 className="text-xl font-bold leading-snug text-foreground">
                      {primaryQuestion?.text || "Waiting for question\u2026"}
                    </h2>
                    {passageBannerText ? (
                      <p className="mt-3 max-h-[30vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted">
                        {passageBannerText}
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              {currentQuestions.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {currentQuestions.map((question) => {
                    const card = buildActiveQuestionCard(
                      question,
                      questionStatsById[question.id],
                    );
                    return (
                      <QuestionCard
                        key={question.id}
                        question={card}
                        mode="timed-summary"
                      />
                    );
                  })}
                </div>
              ) : null}
            </motion.section>
          ) : currentQuestions.length > 0 ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${questionLifecycle}-${effectiveDisplayMode}`}
                {...enterAnimation}
              >
                {passageBannerText ? (
                  <div className="border border-border bg-surface p-6">
                    <p className="label mb-3">Passage</p>
                    <p className="max-w-3xl text-sm leading-7 text-muted">
                      {passageBannerText}
                    </p>
                  </div>
                ) : null}

                {currentQuestions.length > 1 &&
                activePassage?.timerMode === "ENTIRE_PASSAGE" ? (
                  <div className="space-y-4">
                    {currentQuestions.map((question) => {
                      const card = buildActiveQuestionCard(
                        question,
                        questionStatsById[question.id],
                      );
                      return (
                        <QuestionCard
                          key={question.id}
                          question={card}
                          mode={stageMode}
                          onEdit={
                            isReviewing
                              ? () => openScoringDrawer(card)
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                ) : (
                  <QuestionCard
                    question={buildActiveQuestionCard(
                      primaryQuestion!,
                      currentQuestionStats,
                    )}
                    mode={stageMode}
                    onEdit={
                      isReviewing && primaryQuestion
                        ? () =>
                            openScoringDrawer(
                              buildActiveQuestionCard(
                                primaryQuestion,
                                currentQuestionStats,
                              ),
                            )
                        : undefined
                    }
                  />
                )}

                {questionLifecycle === "FROZEN" ? (
                  <div className="mt-4 border border-border bg-background px-4 py-3 text-xs tracking-widest uppercase text-warning">
                    Answers frozen. Grading in progress.
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.section
              {...enterAnimation}
              className="border border-border bg-surface p-8"
            >
              <p className="label mb-3">Waiting</p>
              <h2 className="text-2xl font-bold text-foreground">
                Waiting for the next question
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-muted">
                The session is active, but no question payload has arrived yet.
              </p>
            </motion.section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="border border-border bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="label">Leaderboard</span>
              <span className="text-xs text-muted tabular-nums">
                {activeLeaderboard.length
                  ? `${activeLeaderboard.length} shown`
                  : "Waiting"}
              </span>
            </div>
            <div className="space-y-2">
              {activeLeaderboard.length === 0 ? (
                <p className="text-sm text-muted">No leaderboard data yet.</p>
              ) : (
                activeLeaderboard.map((entry, index) => (
                  <LeaderboardRow
                    key={`${entry.rank}-${entry.displayName}`}
                    rank={entry.rank}
                    displayName={entry.displayName}
                    score={entry.score}
                    variant="compact"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.04 }}
                  />
                ))
              )}
            </div>
          </section>

          <section className="border border-border bg-surface p-6">
            <p className="label mb-4">Session controls</p>
            <div className="space-y-3">
              {questionLifecycle === "DISPLAYED" ? (
                <button
                  onClick={handleStartTimer}
                  disabled={loadingAction === "start-timer"}
                  className="btn-primary w-full"
                >
                  {loadingAction === "start-timer"
                    ? "Starting timer..."
                    : "Start Timer"}
                </button>
              ) : null}

              {questionLifecycle === "TIMED" ? (
                <button
                  onClick={handleEndTimerEarly}
                  disabled={loadingAction === "end-timer"}
                  className="btn-primary w-full"
                >
                  {loadingAction === "end-timer"
                    ? "Freezing..."
                    : "End Timer Early"}
                </button>
              ) : null}

              {questionLifecycle === "REVIEWING" ? (
                <button
                  onClick={handleNextQuestion}
                  disabled={!canAdvance || loadingAction === "next"}
                  className="btn-primary w-full"
                >
                  {loadingAction === "next"
                    ? "Advancing..."
                    : canAdvance
                      ? isLastQuestion
                        ? "Finish quiz"
                        : "Next question"
                      : "Waiting for review"}
                </button>
              ) : null}

              <button
                onClick={handleForceEnd}
                disabled={loadingAction === "end-session"}
                className="w-full border border-border px-5 py-3 text-xs tracking-widest uppercase text-muted transition-colors hover:border-danger/50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loadingAction === "end-session"
                  ? "Ending..."
                  : "Force End Session"}
              </button>
            </div>
          </section>

          <section className="border border-border bg-surface p-6">
            <p className="label mb-4">Session details</p>
            <div className="space-y-3 text-sm text-muted">
              <div className="flex items-center justify-between gap-4">
                <span>Status</span>
                <span className="text-foreground">{sessionStatus}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Lifecycle</span>
                <span className="text-foreground">{questionLifecycle}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Display mode</span>
                <span className="text-foreground">{activeModeLabel}</span>
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
            {currentQuestionStats.totalAnswered > 0 ? (
              <div className="mt-4 border border-border bg-background p-4 text-xs text-muted">
                {currentQuestionStats.totalAnswered} answered
                {currentQuestionStats.totalLockedIn > 0
                  ? ` · ${currentQuestionStats.totalLockedIn} locked in`
                  : ""}
              </div>
            ) : null}
          </section>
        </aside>
      </main>

      <ScoringDrawer
        open={scoringQuestionId !== null}
        questionTitle={scoringQuestionTitle}
        draftOptions={scoringDraft}
        saving={drawerSaving}
        error={scoringError}
        onClose={closeDrawer}
        onChange={(index, value) => {
          setScoringDraft((current) =>
            current.map((option, optionIndex) => {
              if (optionIndex !== index) return option;
              if (value === "-" || value === "")
                return { ...option, pointValue: value };
              const parsed = parseInt(value, 10);
              return isNaN(parsed) ? option : { ...option, pointValue: parsed };
            }),
          );
        }}
        onSave={handleSaveScoring}
      />
    </div>
  );
}
