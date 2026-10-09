"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RollingNumber } from "@/components/ui/AnimatedNumber";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { displayModeLabel } from "@/features/quizzes/editor-model";
import { countLabel, countNoun, formatNumber, percent } from "@/lib/format";
import { rise, spring, stageCut } from "@/lib/motion";
import { AnswerOption } from "../components/AnswerOption";
import { CountdownBar, CountdownClock } from "../components/Countdown";
import { JoinCodeDisplay, JoinInstructions } from "../components/JoinCode";
import { Leaderboard } from "../components/Leaderboard";
import { ScoringDrawer, type ScoringTarget } from "../components/ScoringDrawer";
import { Rundown } from "../components/Rundown";
import { PassagePanel, SessionTopBar } from "../components/SessionChrome";
import { QuestionSlate, slateDetail } from "../components/Slate";
import { WrapUp } from "../components/WrapUp";
import { emptyStats } from "../session-state";
import type { QuestionStats } from "../session-types";
import type { StageQuestion } from "./host-state";
import type { HostSession } from "./useHostSession";

/* ── Lobby ────────────────────────────────────────────────────────────────── */

export function HostLobby({ session }: { session: HostSession }) {
  const { participantCount, joinCode, controls, pending, controlError } =
    session;
  return (
    <>
      <SessionTopBar
        connected={session.connected}
        participantCount={participantCount}
        tally="standby"
        clock
      />
      <main
        id="main"
        className="mx-auto flex w-full max-w-4xl flex-1 animate-rise flex-col items-center justify-center gap-14 px-4 py-12 sm:px-6"
      >
        <JoinInstructions code={joinCode} />

        <div className="flex flex-col items-center gap-2 text-center">
          <RollingNumber
            value={participantCount}
            className="font-mono text-[clamp(3.5rem,9vw,6rem)] leading-none font-semibold text-foreground"
          />
          <p className="flex items-center gap-2 text-muted">
            {participantCount === 0 ? (
              <>
                <span aria-hidden className="live-dot text-accent" />
                Waiting for the first player
              </>
            ) : (
              `${countNoun(participantCount, "player", "players")} ready`
            )}
          </p>
        </div>

        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          {controlError && <Alert className="w-full">{controlError}</Alert>}
          <Button
            variant="primary"
            size="lg"
            icon="play"
            onClick={controls.start}
            pending={pending === "start"}
            className="w-full"
          >
            {pending === "start" ? "Starting…" : "Start the quiz"}
          </Button>
          <p className="text-sm text-subtle">Nobody can join once you start.</p>
        </div>
      </main>
    </>
  );
}

/* ── Live stage ───────────────────────────────────────────────────────────── */

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function HostStage({ session }: { session: HostSession }) {
  const {
    lifecycle,
    questions,
    passage,
    displayMode,
    countdown,
    stats,
    leaderboard,
    totalQuestions,
    joinCode,
    participantCount,
    controls,
    pending,
    controlError,
    canAdvance,
    isLastQuestion,
  } = session;
  const [scoring, setScoring] = useState<ScoringTarget | null>(null);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const first = questions[0];
  const last = questions.at(-1);
  const answered = questions.reduce(
    (sum, q) => sum + (stats[q.id]?.totalAnswered ?? 0),
    0,
  );
  const lockedIn = questions.reduce(
    (sum, q) => sum + (stats[q.id]?.totalLockedIn ?? 0),
    0,
  );
  const expected = participantCount * Math.max(1, questions.length);
  const grading =
    lifecycle === "FROZEN" || (lifecycle === "REVIEWING" && !canAdvance);

  // The one next step, in the dock and on the presenter's clicker.
  const primary =
    lifecycle === "DISPLAYED"
      ? {
          label: "Start timer",
          run: controls.startTimer,
          control: "start-timer" as const,
        }
      : lifecycle === "REVIEWING" && canAdvance
        ? {
            label: isLastQuestion ? "Finish quiz" : "Next question",
            run: controls.next,
            control: "next" as const,
          }
        : null;

  const advance = useEffectEvent(() => {
    if (primary && !pending && !confirmEnd && !scoringOpen) void primary.run();
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || isEditable(event.target)) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const phase =
    lifecycle === "DISPLAYED"
      ? "Players can read the question. Answers open when you start the timer."
      : lifecycle === "TIMED"
        ? displayMode === "CODE_DISPLAY"
          ? "Answering now. Responses stay hidden until time is up."
          : `${formatNumber(answered)} of ${formatNumber(expected)} answers in`
        : grading
          ? "Time's up. Grading answers…"
          : "Results are in. Correct answers are highlighted.";

  const openScoring = (question: StageQuestion) => {
    const points = stats[question.id]?.optionPoints ?? {};
    setScoring({
      questionId: question.id,
      number: question.number,
      text: question.text,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        pointValue: points[option.id] ?? 0,
      })),
    });
    setScoringOpen(true);
  };

  return (
    <>
      <SessionTopBar
        connected={session.connected}
        participantCount={participantCount}
        tally="on-air"
        clock
      >
        <span className="hidden items-center gap-2 text-sm text-muted md:flex">
          Code
          <span className="font-mono text-foreground">{joinCode}</span>
        </span>
      </SessionTopBar>

      <main
        id="main"
        className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_21rem]"
      >
        <section aria-label="Stage" className="flex min-w-0 flex-col gap-4">
          {displayMode === "CODE_DISPLAY" && lifecycle !== "REVIEWING" && (
            <motion.div
              {...rise}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 border border-border bg-surface px-5 py-4"
            >
              <p className="text-muted">Still joining? Enter</p>
              <div className="w-full max-w-sm">
                <JoinCodeDisplay code={joinCode} size="strip" />
              </div>
            </motion.div>
          )}

          {passage && <PassagePanel text={passage.text} />}

          <div className="border border-border bg-surface">
            <CountdownBar countdown={countdown} lifecycle={lifecycle} />
            <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-8 sm:pt-7">
              <p className="pt-2 text-sm text-muted">
                <span className="font-mono text-foreground">
                  {first && last && last.number > first.number
                    ? `Questions ${first.number}–${last.number}`
                    : `Question ${first?.number ?? "–"}`}
                </span>{" "}
                of {totalQuestions} · {displayModeLabel(displayMode)} display
              </p>
              <CountdownClock
                countdown={countdown}
                lifecycle={lifecycle}
                className="text-4xl sm:text-5xl"
              />
            </div>

            <div className="relative">
              {first && last && (
                <QuestionSlate
                  key={questions.map((q) => q.id).join("-")}
                  lifecycle={lifecycle}
                  first={first.number}
                  last={last.number}
                  total={totalQuestions}
                  detail={slateDetail(questions)}
                />
              )}

              {/* The next question starts from the top, not wherever the last
                one was scrolled to. */}
              {/* popLayout, not wait: the new question mounts at once, so
                  the area under the slate reaches its final height in the
                  slate's first frame instead of resizing mid-drop. */}
              <AnimatePresence
                mode="popLayout"
                initial={false}
                onExitComplete={() => window.scrollTo(0, 0)}
              >
                <motion.div
                  key={questions.map((q) => q.id).join("-")}
                  {...stageCut}
                  className="divide-y divide-border px-5 pt-4 pb-6 sm:px-8 sm:pb-8"
                >
                  {questions.length === 0 ? (
                    <p className="py-10 text-center text-muted">
                      The next question is on its way…
                    </p>
                  ) : (
                    questions.map((question) => (
                      <StageQuestionBlock
                        key={question.id}
                        question={question}
                        stats={stats[question.id] ?? emptyStats()}
                        compact={questions.length > 1}
                        countsVisible={
                          displayMode === "LIVE"
                            ? lifecycle !== "DISPLAYED"
                            : Boolean(stats[question.id]?.revealed)
                        }
                        onEditScoring={
                          lifecycle === "REVIEWING" &&
                          stats[question.id]?.reviewed
                            ? () => openScoring(question)
                            : undefined
                        }
                      />
                    ))
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {lifecycle !== "DISPLAYED" && displayMode !== "CODE_DISPLAY" && (
              <div className="border-t border-border px-5 py-4 sm:px-8">
                <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-muted">
                    <span className="font-mono text-foreground">
                      {formatNumber(answered)}
                    </span>{" "}
                    answered
                  </span>
                  <span className="text-subtle">
                    {formatNumber(lockedIn)} locked in
                  </span>
                </div>
                <div aria-hidden className="h-1 overflow-hidden bg-border">
                  <motion.div
                    className="h-full origin-left bg-accent"
                    initial={false}
                    animate={{
                      scaleX:
                        expected > 0 ? Math.min(1, answered / expected) : 0,
                    }}
                    transition={spring.bar}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          {first && last && (
            <Rundown
              total={totalQuestions}
              first={first.number}
              last={last.number}
              lifecycle={lifecycle}
            />
          )}
          <section
            aria-labelledby="standings-heading"
            className="border border-border bg-surface p-5"
          >
            <h2
              id="standings-heading"
              className="mb-4 text-base font-semibold text-foreground"
            >
              Standings
            </h2>
            <Leaderboard entries={leaderboard} limit={10} />
          </section>
        </aside>
      </main>

      <div className="chrome dock-inset sticky bottom-0 z-[var(--z-dock)] border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <p
            role="status"
            aria-live="polite"
            className="min-w-0 flex-1 basis-64 text-sm text-muted"
          >
            {controlError ? (
              <span className="text-danger">{controlError}</span>
            ) : (
              phase
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmEnd(true)}
              className="hover:text-danger"
            >
              End session
            </Button>
            {lifecycle === "TIMED" ? (
              <Button
                size="lg"
                icon="stop"
                onClick={controls.endTimer}
                pending={pending === "end-timer"}
              >
                {pending === "end-timer" ? "Stopping…" : "End timer now"}
              </Button>
            ) : primary ? (
              <Button
                variant="primary"
                size="lg"
                icon={primary.control === "start-timer" ? "play" : undefined}
                trailingIcon={
                  primary.control === "next" ? "arrow-right" : undefined
                }
                onClick={primary.run}
                pending={pending === primary.control}
                title="Shortcut: → or Page Down"
              >
                {primary.label}
              </Button>
            ) : (
              <Button variant="primary" size="lg" pending>
                Grading…
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScoringDrawer
        open={scoringOpen}
        target={scoring}
        onClose={() => setScoringOpen(false)}
        onSave={session.correctScoring}
      />
      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End the session now?"
        description="Questions not yet asked are skipped, and every player goes straight to their results."
        confirmLabel="End session"
        onConfirm={controls.end}
      />
    </>
  );
}

function StageQuestionBlock({
  question,
  stats,
  compact,
  countsVisible,
  onEditScoring,
}: {
  question: StageQuestion;
  stats: QuestionStats;
  compact: boolean;
  countsVisible: boolean;
  onEditScoring?: () => void;
}) {
  const total = stats.totalAnswered;
  return (
    <div className="py-4 first:pt-2">
      <div className="flex items-start justify-between gap-4">
        <h2
          className={`display text-foreground ${
            compact
              ? "text-xl leading-tight sm:text-2xl"
              : "text-[clamp(1.875rem,4.2vw,4.5rem)] leading-[1.04] tracking-[-0.022em]"
          }`}
        >
          {compact && (
            <span className="mr-2 font-mono text-base font-medium text-subtle">
              Q{question.number}
            </span>
          )}
          {question.text}
        </h2>
        {onEditScoring && (
          <Button
            size="sm"
            icon="pencil"
            onClick={onEditScoring}
            className="shrink-0"
          >
            Edit scoring
          </Button>
        )}
      </div>
      <ul className="mt-6 grid gap-2.5 md:grid-cols-2">
        {question.options.map((option, index) => {
          const count = stats.counts[option.id] ?? 0;
          return (
            <li key={option.id}>
              <AnswerOption
                index={index}
                text={option.text}
                size={compact ? "md" : "xl"}
                state={
                  stats.reviewed
                    ? stats.correctOptionIds.includes(option.id)
                      ? "correct"
                      : "dimmed"
                    : undefined
                }
                share={
                  countsVisible ? (total > 0 ? count / total : 0) : undefined
                }
                aside={
                  countsVisible && (
                    <>
                      <span className="text-foreground">
                        {formatNumber(count)}
                      </span>
                      <span className="w-10 text-right text-subtle">
                        {percent(count, total)}%
                      </span>
                    </>
                  )
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Wrap-up ──────────────────────────────────────────────────────────────── */

export function HostEnded({ session }: { session: HostSession }) {
  const { results, participantCount } = session;
  return (
    <>
      <SessionTopBar
        connected
        participantCount={participantCount}
        tally="off-air"
      />
      <main
        id="main"
        className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-24 sm:px-6"
      >
        <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="display display-tight text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.92] text-foreground">
              That&apos;s a wrap
            </h1>
            <p className="mt-3 text-muted">
              {countLabel(participantCount, "player", "players")}
              {results &&
                ` · ${countLabel(results.questions.length, "question", "questions")} · ${results.quizTitle}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {results && (
              <ButtonLink
                href={`/events/${results.eventId}/quizzes/${results.quizId}`}
                variant="ghost"
              >
                Back to the quiz
              </ButtonLink>
            )}
            <ButtonLink
              href={`/session/${session.sessionId}/review`}
              variant="primary"
              trailingIcon="arrow-right"
            >
              Full review
            </ButtonLink>
          </div>
        </header>
        <WrapUp
          results={results}
          leaderboard={session.leaderboard}
          onCorrectScoring={session.correctScoring}
        />
      </main>
    </>
  );
}
