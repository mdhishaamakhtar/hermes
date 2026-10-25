"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/Logo";
import { RollingNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { countNoun, formatNumber, percent } from "@/lib/format";
import { fade, rise, spring, stageCut } from "@/lib/motion";
import { AnswerOption } from "../components/AnswerOption";
import { CountdownBar, CountdownClock } from "../components/Countdown";
import { JoinCodeDisplay, useJoinUrl } from "../components/JoinCode";
import { FinalStandings } from "../components/Leaderboard";
import { StationClock, Tally, type TallyState } from "../components/OnAir";
import { ConnectionStatus } from "../components/SessionChrome";
import { QuestionSlate, slateDetail } from "../components/Slate";
import { emptyStats } from "../session-state";
import type { QuestionStats } from "../session-types";
import type { StageQuestion } from "../host/host-state";
import type { HostSession } from "../host/useHostSession";

/*
 * The big screen: the programme output the room watches. It carries no
 * button a viewer can see. The host runs the show from the controller, or
 * from a clicker plugged into this machine; a small strip with full screen
 * and the keys appears only while the mouse moves, and the cursor hides
 * with it.
 */

const IDLE_MS = 2500;

function usePointerIdle() {
  const [idle, setIdle] = useState(true);
  useEffect(() => {
    let timer = 0;
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, []);
  return idle;
}

function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey)
        return;
      if (event.key === "f" || event.key === "F") toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { fullscreen, toggle };
}

/** The frame every scene sits in: the station's bug above, the join strip below. */
export function ScreenShell({
  session,
  tally,
  joinStrip = true,
  children,
}: {
  session: HostSession;
  tally: TallyState;
  /** The lower third telling latecomers how to join. */
  joinStrip?: boolean;
  children: ReactNode;
}) {
  const idle = usePointerIdle();
  const { fullscreen, toggle } = useFullscreen();

  return (
    <div
      className={`flex h-dvh flex-col overflow-hidden bg-background ${idle ? "cursor-none" : ""}`}
    >
      <header className="flex items-center justify-between gap-6 px-[3vw] pt-[3vh]">
        <Logo size="md" />
        <div className="flex items-center gap-[1.75vw] text-[clamp(1rem,2.2vh,1.5rem)] leading-none">
          <ConnectionStatus connected={session.connected} />
          <span className="flex items-baseline gap-[0.4em] text-muted">
            <RollingNumber
              value={session.participantCount}
              className="font-mono text-foreground"
            />
            {countNoun(session.participantCount, "player", "players")}
          </span>
          <StationClock className="" />
          <Tally state={tally} size="screen" />
        </div>
      </header>

      <main
        id="main"
        className="flex min-h-0 flex-1 flex-col px-[3vw] pt-[3vh] pb-[2vh]"
      >
        {children}
      </main>

      {joinStrip && <JoinStrip code={session.joinCode} />}

      <div
        className={`fixed right-[2vw] bottom-[2vh] flex items-center gap-4 border border-border-strong bg-surface px-4 py-2.5 shadow-(--shadow-float) transition-opacity duration-(--duration-enter) ${
          idle ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <p className="text-sm text-muted">
          <kbd className="font-mono text-foreground">→</kbd> next step ·{" "}
          <kbd className="font-mono text-foreground">F</kbd> full screen
        </p>
        <Button
          size="sm"
          icon={fullscreen ? "collapse" : "expand"}
          onClick={toggle}
        >
          {fullscreen ? "Exit full screen" : "Full screen"}
        </Button>
      </div>
    </div>
  );
}

/** How to get in, kept on screen all show long: joining is open until the end. */
function JoinStrip({ code }: { code: string }) {
  const url = useJoinUrl(code);
  return (
    <footer className="flex items-baseline gap-[1.5vw] border-t border-border px-[3vw] py-[1.6vh] text-[clamp(1rem,2.2vh,1.5rem)] leading-none">
      <span className="text-muted">Join at</span>
      <span className="font-mono text-foreground">{url.display}</span>
      <span aria-hidden className="h-[1em] w-px self-center bg-border-strong" />
      <span className="font-mono font-semibold tracking-[0.18em] text-foreground">
        {code}
      </span>
    </footer>
  );
}

/* ── Lobby ────────────────────────────────────────────────────────────────── */

export function ScreenLobby({ session }: { session: HostSession }) {
  const url = useJoinUrl(session.joinCode);
  const count = session.participantCount;
  return (
    <ScreenShell session={session} tally="standby" joinStrip={false}>
      <div className="flex flex-1 animate-rise flex-col justify-center gap-[6vh]">
        {session.title && (
          <h1 className="display display-tight optical-start max-w-[18ch] text-[clamp(2.5rem,7vh,5.5rem)] leading-[0.92] text-balance text-foreground">
            {session.title}
          </h1>
        )}
        <div className="flex flex-col gap-[2.5vh]">
          <p className="text-[clamp(1.25rem,3.2vh,2.5rem)] text-muted">
            Join at{" "}
            <span className="font-mono text-foreground">{url.display}</span>{" "}
            with the code
          </p>
          <div className="w-[min(100%,calc(17vh*6+5vw))]">
            <JoinCodeDisplay code={session.joinCode} size="screen" />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-[2.5vh]">
        <p className="flex items-baseline gap-[1vw]">
          <RollingNumber
            value={count}
            className="optical-start font-mono text-[clamp(3rem,9vh,7rem)] leading-none font-semibold text-foreground"
          />
          <span className="flex items-center gap-[0.6em] text-[clamp(1.25rem,3vh,2.25rem)] text-muted">
            {count === 0 && (
              <span aria-hidden className="live-dot text-accent" />
            )}
            {count === 0
              ? "Waiting for the first player"
              : `${countNoun(count, "player", "players")} in`}
          </span>
        </p>
      </div>
    </ScreenShell>
  );
}

/* ── Live stage ───────────────────────────────────────────────────────────── */

/** Long questions step down a size so they still fit the frame. */
function questionSize(text: string, compact: boolean) {
  if (compact)
    return "text-[clamp(1.375rem,min(2.4vw,4vh),2.5rem)] leading-tight";
  if (text.length > 150)
    return "text-[clamp(1.75rem,min(3.4vw,6vh),4.25rem)] leading-[1.08]";
  return "text-[clamp(2.25rem,min(4.6vw,8.5vh),6rem)] leading-[1.03] tracking-[-0.022em]";
}

export function ScreenStage({ session }: { session: HostSession }) {
  const {
    lifecycle,
    questions,
    passage,
    displayMode,
    countdown,
    stats,
    totalQuestions,
    joinCode,
    participantCount,
  } = session;
  const first = questions[0];
  const last = questions.at(-1);
  const compact = questions.length > 1;
  const answered = questions.reduce(
    (sum, q) => sum + (stats[q.id]?.totalAnswered ?? 0),
    0,
  );
  const expected = participantCount * Math.max(1, questions.length);
  const showProgress =
    lifecycle !== "DISPLAYED" &&
    (displayMode !== "CODE_DISPLAY" || lifecycle === "REVIEWING");
  const codeOnStage =
    displayMode === "CODE_DISPLAY" && lifecycle !== "REVIEWING";
  const key = questions.map((q) => q.id).join("-");

  return (
    <ScreenShell session={session} tally="on-air" joinStrip={!codeOnStage}>
      <div className="flex items-baseline justify-between gap-[3vw]">
        <p className="font-mono text-[clamp(1.125rem,2.6vh,2rem)] text-muted">
          <span className="text-foreground">
            {first && last && last.number > first.number
              ? `Questions ${first.number}–${last.number}`
              : `Question ${first?.number ?? "–"}`}
          </span>{" "}
          of {totalQuestions}
        </p>
        <CountdownClock
          countdown={countdown}
          lifecycle={lifecycle}
          className="optical-end text-[clamp(3rem,10vh,8rem)]"
        />
      </div>
      <CountdownBar
        countdown={countdown}
        lifecycle={lifecycle}
        className="mt-[1.5vh] h-[0.7vh]!"
      />

      <div
        className={`mt-[3.5vh] min-h-0 flex-1 ${
          passage
            ? "grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-[3vw]"
            : "flex flex-col"
        }`}
      >
        {passage && (
          <section
            aria-label="Passage"
            className="min-h-0 overflow-hidden border border-border bg-surface px-[2vw] py-[2.5vh]"
          >
            <p className="max-w-[60ch] text-[clamp(1.125rem,min(1.7vw,2.9vh),2rem)] leading-[1.55] whitespace-pre-wrap text-foreground/90">
              {passage.text}
            </p>
          </section>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col">
          {first && last && (
            <QuestionSlate
              key={key}
              lifecycle={lifecycle}
              first={first.number}
              last={last.number}
              total={totalQuestions}
              detail={slateDetail(questions)}
            />
          )}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={key}
              {...stageCut}
              className={`flex min-h-0 flex-1 flex-col ${compact ? "gap-[3vh]" : ""}`}
            >
              {questions.length === 0 ? (
                <p className="m-auto text-[clamp(1.25rem,3vh,2rem)] text-muted">
                  The next question is on its way…
                </p>
              ) : (
                questions.map((question) => (
                  <ScreenQuestion
                    key={question.id}
                    question={question}
                    stats={stats[question.id] ?? emptyStats()}
                    compact={compact}
                    countsVisible={
                      displayMode === "LIVE"
                        ? lifecycle !== "DISPLAYED"
                        : Boolean(stats[question.id]?.revealed)
                    }
                  />
                ))
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {codeOnStage && (
          <motion.div
            {...rise}
            className="mt-[3vh] flex items-center gap-[2vw] border border-border bg-surface px-[2vw] py-[2vh]"
          >
            <p className="text-[clamp(1.125rem,2.8vh,2rem)] text-muted">
              Still joining? Enter
            </p>
            <div className="w-[min(60%,calc(8vh*6+3vw))]">
              <JoinCodeDisplay code={joinCode} size="strip" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showProgress && (
          <motion.div {...fade} className="mt-[3vh]">
            <div className="mb-[1vh] flex justify-between font-mono text-[clamp(1rem,2.2vh,1.5rem)] text-muted">
              <span>
                <span className="text-foreground">
                  {formatNumber(answered)}
                </span>{" "}
                of {formatNumber(expected)} answered
              </span>
              <span>{percent(answered, expected)}%</span>
            </div>
            <div aria-hidden className="h-[0.7vh] overflow-hidden bg-border">
              <motion.div
                className="h-full origin-left bg-accent"
                initial={false}
                animate={{
                  scaleX: expected > 0 ? Math.min(1, answered / expected) : 0,
                }}
                transition={spring.bar}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ScreenShell>
  );
}

function ScreenQuestion({
  question,
  stats,
  compact,
  countsVisible,
}: {
  question: StageQuestion;
  stats: QuestionStats;
  compact: boolean;
  countsVisible: boolean;
}) {
  const total = stats.totalAnswered;
  return (
    <section
      aria-label={`Question ${question.number}`}
      className={compact ? "" : "flex min-h-0 flex-1 flex-col justify-center"}
    >
      <h2
        className={`display optical-start text-balance text-foreground ${questionSize(question.text, compact)}`}
      >
        {compact && (
          <span className="mr-3 font-mono text-[0.6em] font-medium text-subtle">
            Q{question.number}
          </span>
        )}
        {question.text}
      </h2>
      <ul
        className={`grid grid-cols-2 ${compact ? "mt-[2vh] gap-[1.2vh]" : "mt-[6vh] gap-[1.6vh]"}`}
      >
        {question.options.map((option, index) => {
          const count = stats.counts[option.id] ?? 0;
          return (
            <li key={option.id}>
              <AnswerOption
                index={index}
                text={option.text}
                size={compact ? "xl" : "screen"}
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
                      <span className="w-[3.2em] text-right text-muted">
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
    </section>
  );
}

/* ── Wrap-up ──────────────────────────────────────────────────────────────── */

export function ScreenEnded({ session }: { session: HostSession }) {
  return (
    <ScreenShell session={session} tally="off-air" joinStrip={false}>
      <motion.div
        {...fade}
        className="mx-auto flex w-full max-w-[min(80rem,90vw)] flex-1 flex-col justify-center gap-[5vh]"
      >
        <h1 className="display display-tight optical-start text-[clamp(3rem,10vh,6rem)] leading-[0.9] text-foreground">
          That&apos;s a wrap
        </h1>
        <FinalStandings entries={session.leaderboard} size="screen" />
      </motion.div>
    </ScreenShell>
  );
}
