"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import Logo from "@/components/Logo";
import LeaderboardRow from "@/components/ui/LeaderboardRow";
import { CardBadge } from "@/components/session/CardBadge";
import { QuestionCard } from "@/components/session/QuestionCard";
import { ScoringDrawer } from "@/components/session/ScoringDrawer";
import { formatTime, formatParticipantCount } from "@/lib/session-utils";
import { enterAnimation } from "@/lib/design-tokens";
import {
  buildActiveQuestionCard,
  useHostSession,
} from "@/features/session/host/useHostSession";

export default function HostPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
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
    hydrated,
    copied,
    loadingAction,
    drawerSaving,
    scoringQuestionId,
    scoringQuestionTitle,
    scoringDraft,
    setScoringDraft,
    currentQuestions,
    primaryQuestion,
    reviewQuestions,
    currentQuestionStats,
    canAdvance,
    timerColour,
    timerPct,
    openScoringDrawer,
    closeDrawer,
    handleStartSession,
    handleStartTimer,
    handleEndTimerEarly,
    handleNextQuestion,
    handleForceEnd,
    handleCopyCode,
    handleSaveScoring,
    activeModeLabel,
    progressLabel,
  } = useHostSession(id);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 border border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (sessionStatus === "LOBBY") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-4 sm:px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Logo size="sm" />
            <div className="flex items-center gap-3">
              <CardBadge tone="warning">Lobby</CardBadge>
              <div className="border border-border bg-surface px-4 py-2 text-right">
                <p className="label mb-1">Audience</p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {participantCount}
                </p>
                <p className="text-[11px] text-muted">
                  {formatParticipantCount(participantCount)}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-7xl items-center justify-center px-4 sm:px-6 py-10">
          <motion.div
            {...enterAnimation}
            className="w-full max-w-2xl border border-border bg-surface p-8 text-center"
          >
            <p className="label mb-4">Share this code</p>
            <div
              className="select-all border border-primary/30 bg-background px-8 py-6 font-black tracking-[0.35em] text-foreground"
              style={{
                fontSize: "clamp(2rem, 7vw, 4rem)",
                letterSpacing: "0.35em",
                paddingLeft: "calc(2rem + 0.35em)",
              }}
            >
              {joinCode || "------"}
            </div>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={handleCopyCode}
                disabled={!joinCode}
                className="border border-border px-4 py-2 text-xs tracking-widest uppercase text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? "Copied" : "Copy code"}
              </button>
              <span className="text-xs text-muted tabular-nums">
                {formatParticipantCount(participantCount)} in lobby
              </span>
            </div>
            <div className="mt-10 flex items-center justify-center gap-3">
              <button
                onClick={handleStartSession}
                disabled={loadingAction === "start-session"}
                className="btn-primary"
              >
                {loadingAction === "start-session"
                  ? "Starting..."
                  : "Start Session"}
              </button>
            </div>
          </motion.div>
        </main>

        <ScoringDrawer
          open={false}
          questionTitle=""
          draftOptions={[]}
          saving={false}
          onClose={closeDrawer}
          onChange={() => {}}
          onSave={() => {}}
        />
      </div>
    );
  }

  if (sessionStatus === "ENDED") {
    const leaderboardRows = finalLeaderboard ?? leaderboard;
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-4 sm:px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Logo size="sm" />
            <div className="flex items-center gap-3">
              <CardBadge tone="muted">Ended</CardBadge>
              <span className="text-xs text-muted tabular-nums">
                {formatParticipantCount(participantCount)}
              </span>
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
              <h1 className="text-3xl font-bold text-foreground">
                Final review
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-muted">
                Session results are locked, but scoring corrections are still
                available. Open any question and update its point values to
                recalculate the leaderboard.
              </p>
            </motion.div>

            <div className="space-y-4">
              {reviewQuestions.length === 0 ? (
                <div className="border border-border bg-surface p-6 text-sm text-muted">
                  Loading results...
                </div>
              ) : (
                reviewQuestions.map((question, index) => (
                  <motion.div
                    key={question.id}
                    {...enterAnimation}
                    transition={{
                      ...enterAnimation.transition,
                      delay: index * 0.03,
                    }}
                  >
                    <QuestionCard
                      question={question}
                      mode="review"
                      onEdit={() => openScoringDrawer(question)}
                    />
                  </motion.div>
                ))
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
          onClose={closeDrawer}
          onChange={(index, value) =>
            setScoringDraft((current) =>
              current.map((option, optionIndex) =>
                optionIndex === index
                  ? { ...option, pointValue: value }
                  : option,
              ),
            )
          }
          onSave={handleSaveScoring}
        />
      </div>
    );
  }

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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
          <Logo size="sm" />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <CardBadge
              tone={sessionStatus === "ACTIVE" ? "success" : "warning"}
            >
              {sessionStatus}
            </CardBadge>
            <CardBadge tone="accent">{questionLifecycle}</CardBadge>
            <div className="border border-border bg-surface px-4 py-2 text-right">
              <p className="label mb-1">Live audience</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {participantCount}
              </p>
              <p className="text-[11px] text-muted">
                {formatParticipantCount(participantCount)}
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              disabled={!joinCode}
              className="border border-border px-3 py-2 text-xs tracking-widest uppercase text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? "Copied" : joinCode || "Copy code"}
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
                  {formatTime(timeLeft)}
                </div>
              </div>
              <div className="w-full max-w-sm">
                <div className="h-1 bg-border">
                  <motion.div
                    className="h-full origin-left"
                    animate={{ scaleX: timerPct / 100 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      backgroundColor: timerColour,
                      willChange: "transform",
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.section>

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
                      activePassage?.timerMode === "PER_SUB_QUESTION"
                        ? activePassage.text
                        : null,
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
                        null,
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
                      activePassage?.timerMode === "PER_SUB_QUESTION"
                        ? activePassage.text
                        : null,
                    )}
                    mode={stageMode}
                    onEdit={
                      isReviewing && primaryQuestion
                        ? () =>
                            openScoringDrawer(
                              buildActiveQuestionCard(
                                primaryQuestion,
                                currentQuestionStats,
                                activePassage?.timerMode === "PER_SUB_QUESTION"
                                  ? activePassage.text
                                  : null,
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
                      ? "Next Question"
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
                  {formatTime(timeLeft)}
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
