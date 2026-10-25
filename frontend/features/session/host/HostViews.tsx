"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RollingNumber } from "@/components/ui/AnimatedNumber";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { displayModeNote } from "@/features/quizzes/editor-model";
import { countLabel, countNoun, formatNumber, percent } from "@/lib/format";
import { spring, stageCut } from "@/lib/motion";
import { AnswerOption } from "../components/AnswerOption";
import { CountdownBar, CountdownClock } from "../components/Countdown";
import { copy, JoinCodeDisplay, useJoinUrl } from "../components/JoinCode";
import { JoinQr } from "../components/JoinQr";
import { Leaderboard } from "../components/Leaderboard";
import { ScoringDrawer, type ScoringTarget } from "../components/ScoringDrawer";
import { ScoringRules } from "../components/ScoringRules";
import { Rundown } from "../components/Rundown";
import { PassagePanel, SessionTopBar } from "../components/SessionChrome";
import { WrapUp } from "../components/WrapUp";
import { emptyStats } from "../session-state";
import type { QuestionStats } from "../session-types";
import type { StageQuestion } from "./host-state";
import { useClicker } from "./useClicker";
import type { HostSession } from "./useHostSession";

/*
 * The controller: the host's private view of the show. The room watches the
 * big screen (/screen); this page is where the host sees every count,
 * the standings and the next step, and it fits a phone, so the host can
 * walk the room. A clicker works here and on the big screen alike.
 */

function screenUrl(sessionId: string) {
  return `/session/${sessionId}/screen`;
}

/** Opens the big screen in its own window, or brings that window back. */
function openScreen(sessionId: string) {
  window.open(screenUrl(sessionId), `hermes-screen-${sessionId}`);
}

function ScreenButton({ sessionId }: { sessionId: string }) {
  return (
    <Button
      size="sm"
      icon="screen"
      onClick={() => openScreen(sessionId)}
      title="Open the big screen in a new window"
    >
      <span className="max-sm:sr-only">Big screen</span>
    </Button>
  );
}

/** The step the dock is waiting on, under the host's thumb on a phone. */
function Dock({
  status,
  children,
}: {
  status: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="chrome dock-inset sticky bottom-0 z-[var(--z-dock)] border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
        <p
          role="status"
          aria-live="polite"
          className="min-w-0 text-sm text-muted sm:flex-1"
        >
          {status}
        </p>
        {/* On a phone the main control takes a row of its own under the
            others, so nothing is pushed off the edge. */}
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Lobby ────────────────────────────────────────────────────────────────── */

export function HostLobby({ session }: { session: HostSession }) {
  const {
    sessionId,
    participantCount,
    joinCode,
    nextStep,
    pending,
    controlError,
  } = session;
  const url = useJoinUrl(joinCode);
  useClicker(session.advance);

  return (
    <>
      <SessionTopBar
        connected={session.connected}
        participantCount={participantCount}
        tally="standby"
        clock
      >
        <ScreenButton sessionId={sessionId} />
      </SessionTopBar>

      <main
        id="main"
        className="mx-auto grid w-full max-w-6xl flex-1 animate-rise content-start gap-8 px-4 pt-8 pb-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:pt-12"
      >
        <div className="flex min-w-0 flex-col gap-8">
          <header>
            {session.rehearsal && (
              <Badge tone="warning" dot className="mb-5">
                Rehearsal
              </Badge>
            )}
            <h1 className="display display-tight text-[clamp(2.5rem,6vw,4rem)] leading-[0.92] text-balance text-foreground">
              {session.title || "Lobby"}
            </h1>
            <p className="mt-3 max-w-[38rem] text-lg text-muted">
              {session.rehearsal
                ? "A run-through on your own. Join on your phone to see what players see, and open the big screen to see what the room sees. Nothing from a rehearsal is kept."
                : "Players are joining. Put the big screen on the projector, then start when the room is ready."}
            </p>
          </header>

          {session.rehearsal && joinCode && (
            <section
              aria-labelledby="rehearse-heading"
              className="flex flex-col gap-5 border border-border bg-surface p-5 sm:flex-row sm:items-center sm:p-6"
            >
              <JoinQr url={url.withCode} className="size-32 shrink-0" />
              <div className="min-w-0">
                <h2
                  id="rehearse-heading"
                  className="font-semibold text-foreground"
                >
                  Play along on your phone
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Scan this with your phone&apos;s camera to join as a player,
                  then run the quiz from here.
                </p>
              </div>
            </section>
          )}

          <section
            aria-labelledby="screen-heading"
            className="flex flex-col gap-5 border border-border bg-surface p-5 sm:flex-row sm:items-center sm:p-6"
          >
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center border border-primary/60 bg-primary/10 text-accent"
            >
              <Icon name="screen" size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="screen-heading" className="font-semibold text-foreground">
                The big screen
              </h2>
              <p className="mt-1 text-sm text-muted">
                It shows the join code now and each question once you start. You
                run the show from here, from your phone, or with a clicker on
                either.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="primary"
                trailingIcon="external"
                onClick={() => openScreen(sessionId)}
              >
                Open it
              </Button>
              <Button
                icon="link"
                onClick={() =>
                  void copy(
                    `${window.location.origin}${screenUrl(sessionId)}`,
                    "Big screen link copied",
                  )
                }
              >
                Copy link
              </Button>
            </div>
          </section>

          <section
            aria-labelledby="join-heading"
            className="border border-border bg-surface p-5 sm:p-6"
          >
            <h2 id="join-heading" className="font-semibold text-foreground">
              Players join at{" "}
              <span className="font-mono text-accent">{url.display}</span>
            </h2>
            <div className="mt-5 max-w-md">
              <JoinCodeDisplay code={joinCode} size="strip" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                size="sm"
                icon="copy"
                disabled={!joinCode}
                onClick={() => void copy(joinCode, "Join code copied")}
              >
                Copy code
              </Button>
              <Button
                size="sm"
                icon="link"
                disabled={!joinCode}
                onClick={() => void copy(url.withCode, "Join link copied")}
              >
                Copy join link
              </Button>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section
            aria-labelledby="players-heading"
            className="border border-border bg-surface p-5"
          >
            <h2
              id="players-heading"
              className="text-base font-semibold text-foreground"
            >
              Players
            </h2>
            <p className="mt-3 flex items-baseline gap-3">
              <RollingNumber
                value={participantCount}
                className="font-mono text-5xl leading-none font-semibold text-foreground"
              />
              <span className="flex items-center gap-2 text-muted">
                {participantCount === 0 ? (
                  <>
                    <span aria-hidden className="live-dot text-accent" />
                    Waiting for the first
                  </>
                ) : (
                  `${countNoun(participantCount, "player", "players")} in`
                )}
              </span>
            </p>
            <PlayerList session={session} className="mt-4" />
          </section>
          <ScoringRules
            rules={session.scoring}
            audience="host"
            className="border border-border bg-surface p-5"
          />
        </aside>
      </main>

      <Dock
        status={
          controlError ? (
            <span className="text-danger">{controlError}</span>
          ) : participantCount === 0 ? (
            "You can start once the first player is in."
          ) : (
            "Latecomers can still join with the code once you start."
          )
        }
      >
        <Button
          variant="primary"
          size="lg"
          icon="play"
          onClick={session.controls.start}
          pending={pending === "start"}
          disabled={!nextStep}
          title="Shortcut: → or Page Down"
          className="max-sm:flex-1"
        >
          {pending === "start" ? "Starting…" : "Start the quiz"}
        </Button>
      </Dock>
    </>
  );
}

/* ── Live controller ──────────────────────────────────────────────────────── */

export function HostStage({ session }: { session: HostSession }) {
  const {
    sessionId,
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
    nextStep,
  } = session;
  const [scoring, setScoring] = useState<ScoringTarget | null>(null);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const toggleStandings = () => {
    if (session.canShowStandings) {
      void session.setScene(
        session.scene === "STANDINGS" ? "QUESTION" : "STANDINGS",
      );
    }
  };
  useClicker(session.advance, !confirmEnd && !scoringOpen, toggleStandings);

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
  const hiddenFromRoom = displayMode !== "LIVE";

  const phase =
    lifecycle === "DISPLAYED"
      ? "Players can read the question. Answers open when you start the timer."
      : lifecycle === "TIMED"
        ? `${formatNumber(answered)} of ${formatNumber(expected)} answers in${
            hiddenFromRoom
              ? ". The big screen keeps them hidden until time is up."
              : "."
          }`
        : grading
          ? "Time's up. Grading answers…"
          : "Results are in. The big screen shows the right answer.";

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
        <ScreenButton sessionId={sessionId} />
      </SessionTopBar>

      <main
        id="main"
        className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_21rem]"
      >
        <section
          aria-label="Now on the big screen"
          className="flex min-w-0 flex-col gap-4"
        >
          {passage && <PassagePanel text={passage.text} />}

          <div className="border border-border bg-surface">
            <CountdownBar countdown={countdown} lifecycle={lifecycle} />
            <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
              <p className="pt-1.5 text-sm text-muted">
                <span className="font-mono text-foreground">
                  {first && last && last.number > first.number
                    ? `Questions ${first.number}–${last.number}`
                    : `Question ${first?.number ?? "–"}`}
                </span>{" "}
                of {totalQuestions}
                {questions.length === 1 && first?.poll && (
                  <span className="text-accent"> · Poll</span>
                )}
                <span className="max-sm:block">
                  <span className="max-sm:hidden"> · </span>
                  {displayModeNote(displayMode)}
                </span>
              </p>
              <CountdownClock
                countdown={countdown}
                lifecycle={lifecycle}
                className="text-4xl"
              />
            </div>

            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={questions.map((q) => q.id).join("-")}
                {...stageCut}
                className="divide-y divide-border px-5 pb-6 sm:px-6"
              >
                {questions.length === 0 ? (
                  <p className="py-10 text-center text-muted">
                    The next question is on its way…
                  </p>
                ) : (
                  questions.map((question) => (
                    <ControllerQuestion
                      key={question.id}
                      question={question}
                      stats={stats[question.id] ?? emptyStats()}
                      compact={questions.length > 1}
                      countsVisible={lifecycle !== "DISPLAYED"}
                      onEditScoring={
                        lifecycle === "REVIEWING" &&
                        !question.poll &&
                        stats[question.id]?.reviewed
                          ? () => openScoring(question)
                          : undefined
                      }
                    />
                  ))
                )}
              </motion.div>
            </AnimatePresence>

            {lifecycle !== "DISPLAYED" && (
              <div className="border-t border-border px-5 py-4 sm:px-6">
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
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2
                id="standings-heading"
                className="text-base font-semibold text-foreground"
              >
                Standings
              </h2>
              <span className="text-xs text-subtle">Only you see these</span>
            </div>
            <Leaderboard entries={leaderboard} limit={10} />
          </section>
          <details className="group border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-base font-semibold text-foreground">
              <span>
                Players{" "}
                <span className="font-mono text-sm font-medium text-subtle">
                  {participantCount}
                </span>
              </span>
              <Icon
                name="chevron-down"
                className="text-subtle transition-transform duration-(--duration-base) group-open:rotate-180"
              />
            </summary>
            <PlayerList session={session} className="px-5 pb-5" />
          </details>
        </aside>
      </main>

      <Dock
        status={
          controlError ? (
            <span className="text-danger">{controlError}</span>
          ) : (
            phase
          )
        }
      >
        <Button
          variant="ghost"
          onClick={() => setConfirmEnd(true)}
          className="shrink-0 hover:text-danger max-sm:ghost-flush-start"
        >
          End session
        </Button>
        {session.canShowStandings && (
          <Button
            icon="standings"
            onClick={toggleStandings}
            aria-pressed={session.scene === "STANDINGS"}
            title="Shortcut: S"
            className="shrink-0 max-sm:ml-auto"
          >
            {session.scene === "STANDINGS" ? "Hide standings" : "Standings"}
          </Button>
        )}
        {lifecycle === "TIMED" ? (
          <Button
            size="lg"
            icon="stop"
            onClick={controls.endTimer}
            pending={pending === "end-timer"}
            className="max-sm:basis-full"
          >
            {pending === "end-timer" ? "Stopping…" : "End timer now"}
          </Button>
        ) : nextStep ? (
          <Button
            variant="primary"
            size="lg"
            icon={nextStep.control === "start-timer" ? "play" : undefined}
            trailingIcon={
              nextStep.control === "next" ? "arrow-right" : undefined
            }
            onClick={nextStep.run}
            pending={pending === nextStep.control}
            title="Shortcut: → or Page Down"
            className="max-sm:basis-full"
          >
            {nextStep.label}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            pending
            className="max-sm:basis-full"
          >
            Grading…
          </Button>
        )}
      </Dock>

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

/** A question as the host sees it: every count, whatever the room is shown. */
function ControllerQuestion({
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
    <div className="py-4 first:pt-3">
      {/* Beside the question on a wide screen; under it on a phone, where
          it would squeeze the question to a word a line. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <h2
          className={`display text-balance text-foreground ${
            compact
              ? "text-lg leading-tight sm:text-xl"
              : "text-2xl leading-[1.1] sm:text-3xl"
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
      <ul className="mt-5 grid gap-2 md:grid-cols-2">
        {question.options.map((option, index) => {
          const count = stats.counts[option.id] ?? 0;
          return (
            <li key={option.id}>
              <AnswerOption
                index={index}
                text={option.text}
                state={
                  // A poll has no key: its reveal is the split alone.
                  stats.reviewed && !question.poll
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
                      <span className="w-10 text-right text-muted">
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

/* ── Players ──────────────────────────────────────────────────────────────── */

/**
 * Everyone in the room, newest first, each with a way out: a name that
 * should not be on the big screen can be removed before anyone reads it.
 */
function PlayerList({
  session,
  className = "",
}: {
  session: HostSession;
  className?: string;
}) {
  const [target, setTarget] = useState<{ id: number; name: string } | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const players = session.players.toReversed();

  if (players.length === 0) return null;

  return (
    <>
      <ul
        className={`flex max-h-80 flex-col overflow-y-auto border-t border-border ${className}`}
      >
        {players.map((player) => (
          <li
            key={player.participantId}
            className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0"
          >
            <span className="min-w-0 truncate text-sm text-foreground">
              {player.displayName}
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon="close"
              aria-label={`Remove ${player.displayName}`}
              title="Remove from the session"
              className="ghost-flush-end shrink-0 hover:text-danger"
              onClick={() => {
                setTarget({
                  id: player.participantId,
                  name: player.displayName,
                });
                setOpen(true);
              }}
            />
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Remove ${target?.name ?? "this player"}?`}
        description="They leave the session, their answers and points go with them, and their phone tells them so. They can join again with the code."
        confirmLabel="Remove"
        onConfirm={() => (target ? session.removePlayer(target.id) : undefined)}
      />
    </>
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
      >
        <ScreenButton sessionId={session.sessionId} />
      </SessionTopBar>
      <main
        id="main"
        className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-24 sm:px-6"
      >
        <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="display display-tight text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.92] text-foreground">
              {session.rehearsal ? "Rehearsal over" : "That's a wrap"}
            </h1>
            <p className="mt-3 text-muted">
              {session.rehearsal
                ? "Nothing from it is kept. Change what you need, then run it for real."
                : [
                    countLabel(participantCount, "player", "players"),
                    results &&
                      countLabel(
                        results.questionsAsked ?? results.questions.length,
                        "question",
                        "questions",
                      ),
                    results?.quizTitle,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {results && (
              <ButtonLink
                href={`/events/${results.eventId}/quizzes/${results.quizId}`}
                variant={session.rehearsal ? "primary" : undefined}
                trailingIcon={session.rehearsal ? "arrow-right" : undefined}
              >
                Back to the quiz
              </ButtonLink>
            )}
            {!session.rehearsal && (
              <ButtonLink
                href={`/session/${session.sessionId}/review`}
                variant="primary"
                trailingIcon="arrow-right"
              >
                Full review
              </ButtonLink>
            )}
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
