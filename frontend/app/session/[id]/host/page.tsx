"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import Logo from "@/components/Logo";
import { SessionPageSkeleton } from "@/components/PageSkeleton";
import LeaderboardRow from "@/components/ui/LeaderboardRow";
import { CardBadge } from "@/components/session/CardBadge";
import { QuestionCard } from "@/components/session/QuestionCard";
import { ScoringDrawer } from "@/components/session/ScoringDrawer";
import { LiveParticipantCount } from "@/components/session/LiveParticipantCount";
import {
  formatCountdownClock,
  formatParticipantCountPhrase,
} from "@/lib/session-utils";
import { enterAnimation } from "@/lib/design-tokens";
import type { SessionResults } from "@/lib/types";
import {
  buildActiveQuestionCard,
  buildResultsQuestionCard,
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
    scoringError,
    setScoringDraft,
    currentQuestions,
    primaryQuestion,
    sessionResults,
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
    isLastQuestion,
  } = useHostSession(id);

  if (!hydrated) return <SessionPageSkeleton />;

  if (sessionStatus === "LOBBY") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-4 sm:px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Logo size="sm" />
            <div className="flex min-w-0 items-center gap-3">
              <CardBadge tone="warning">Lobby</CardBadge>
              <LiveParticipantCount
                count={participantCount}
                caption={formatParticipantCountPhrase(participantCount)}
                size="sm"
                layout="inline"
              />
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
            <div className="mt-6 flex flex-col items-center gap-6">
              <button
                onClick={handleCopyCode}
                disabled={!joinCode}
                className="border border-border px-4 py-3 text-xs tracking-widest uppercase text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? "Copied" : "Copy code"}
              </button>
              <LiveParticipantCount
                count={participantCount}
                caption="in lobby"
                size="lg"
                layout="stack"
                className="w-full max-w-sm"
              />
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
                    } else if (
                      q.passageId === currentPassageId &&
                      currentGroup
                    ) {
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-4">
          <Logo size="sm" />
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
            <CardBadge
              tone={sessionStatus === "ACTIVE" ? "success" : "warning"}
            >
              {sessionStatus}
            </CardBadge>
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
