"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/Logo";
import { RollingNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { countNoun, formatNumber, percent } from "@/lib/format";
import { duration, ease, fade, spring, stageCut } from "@/lib/motion";
import { soundSetting, stageAudio } from "@/lib/stage-audio";
import { AnswerOption } from "../components/AnswerOption";
import { CountdownBar, CountdownClock } from "../components/Countdown";
import { JoinCodeDisplay, useJoinUrl } from "../components/JoinCode";
import { JoinQr } from "../components/JoinQr";
import {
  FinalStandings,
  Leaderboard,
  PODIUM_DELAY,
} from "../components/Leaderboard";
import { StationClock, Tally, type TallyState } from "../components/OnAir";
import { PlayerRoll } from "../components/PlayerRoll";
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

export function useSoundOn() {
  return useSyncExternalStore(
    soundSetting.subscribe,
    soundSetting.get,
    soundSetting.getServer,
  );
}

/**
 * Plays the stage cues off the session's real state changes, when the
 * screen's sound is on. Each cue fires on the transition, never on a
 * render, so a resync that repeats the same state stays silent.
 */
export function useStageSounds(session: HostSession) {
  const on = useSoundOn();
  const reviewed =
    session.questions.length > 0 &&
    session.questions.every((q) => session.stats[q.id]?.reviewed);
  const now = {
    status: session.status,
    lifecycle: session.lifecycle,
    reviewed,
    scene: session.scene,
  };
  const previous = useRef(now);

  // A saved "on" still needs a press before a browser lets audio play: the
  // clicker's first key, or any click, unlocks it.
  useEffect(() => {
    if (!on) return;
    const unlock = () => void stageAudio.unlock();
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pointerdown", unlock);
    };
  }, [on]);

  useEffect(() => {
    const before = previous.current;
    previous.current = now;
    if (!on || now.status !== "ACTIVE") return;
    if (now.lifecycle === "TIMED" && before.lifecycle !== "TIMED") {
      stageAudio.answersOpen();
    }
    if (now.lifecycle === "FROZEN" && before.lifecycle === "TIMED") {
      stageAudio.timeUp();
    }
    if (now.reviewed && !before.reviewed) stageAudio.reveal();
    if (now.scene === "STANDINGS" && before.scene !== "STANDINGS") {
      stageAudio.standings();
    }
  });

  // The finale's places land on the podium's own timing.
  const ended = session.status === "ENDED";
  const scorers = session.leaderboard.filter((e) => e.score > 0).length;
  useEffect(() => {
    if (!ended || !on) return;
    const timers = PODIUM_DELAY.show
      .slice(0, Math.min(3, scorers))
      .map((delay, index) =>
        window.setTimeout(() => stageAudio.place(index + 1), delay * 1000),
      );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [ended, on, scorers]);
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
  const sound = useSoundOn();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey)
        return;
      if (event.key === "m" || event.key === "M") void soundSetting.set(!sound);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sound]);

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
          <kbd className="font-mono text-foreground">→</kbd> next ·{" "}
          <kbd className="font-mono text-foreground">S</kbd> standings ·{" "}
          <kbd className="font-mono text-foreground">M</kbd> sound ·{" "}
          <kbd className="font-mono text-foreground">F</kbd> full screen
        </p>
        <Button
          size="sm"
          icon={sound ? "volume" : "volume-off"}
          onClick={() => void soundSetting.set(!sound)}
        >
          {sound ? "Sound on" : "Sound off"}
        </Button>
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
      <div className="grid flex-1 animate-rise grid-cols-[minmax(0,1fr)_auto] items-center gap-[5vw]">
        <div className="flex min-w-0 flex-col gap-[6vh]">
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
        {session.joinCode && (
          <figure className="flex flex-col items-center gap-[1.5vh]">
            <JoinQr
              url={url.withCode}
              className="size-[clamp(11rem,34vh,24rem)]"
            />
            <figcaption className="text-[clamp(1rem,2.4vh,1.75rem)] text-muted">
              or scan to join
            </figcaption>
          </figure>
        )}
      </div>

      <div className="flex flex-col gap-[2vh] border-t border-border pt-[2.5vh]">
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
        {session.players.length > 0 && (
          <PlayerRoll
            players={session.players}
            limit={24}
            size="screen"
            className="max-h-[16vh] overflow-hidden"
          />
        )}
      </div>
    </ScreenShell>
  );
}

/* ── Standings ────────────────────────────────────────────────────────────── */

/** The scoreboard segment the host cuts to between questions. */
export function ScreenStandings({ session }: { session: HostSession }) {
  const last = session.questions.at(-1);
  // A scoreboard lists who has scored; the rest are level on zero.
  const scorers = session.leaderboard.filter((entry) => entry.score > 0);
  return (
    <ScreenShell session={session} tally="on-air">
      <motion.div
        {...fade}
        className="mx-auto flex min-h-0 w-full max-w-[min(80rem,90vw)] flex-1 flex-col justify-center gap-[3.5vh]"
      >
        <div className="flex items-baseline justify-between gap-[3vw]">
          <h1 className="display display-tight optical-start text-[clamp(2.5rem,8vh,5rem)] leading-[0.9] text-foreground">
            Standings
          </h1>
          {last && (
            <p className="font-mono text-[clamp(1.125rem,2.6vh,2rem)] text-muted">
              after <span className="text-foreground">Q{last.number}</span> of{" "}
              {session.totalQuestions}
            </p>
          )}
        </div>
        <Leaderboard
          entries={scorers}
          limit={8}
          size={scorers.length > 5 ? "screen" : "screen-lg"}
          emptyText="Nobody has scored yet."
        />
      </motion.div>
    </ScreenShell>
  );
}

/* ── Live stage ───────────────────────────────────────────────────────────── */

/** The smallest a block may shrink to fit; past it, it clips. */
const FIT_FLOOR = 0.62;

/**
 * Keeps a block inside the frame it sits in. A projector can't scroll, so
 * when a long question, passage or set of answers would run past the edge,
 * its type steps down (by CSS zoom, which reflows the text rather than
 * shrinking a picture of it) until the whole block shows. Content that
 * already fits is left at full size.
 */
function FitFrame({
  children,
  className = "",
  align = "center",
}: {
  children: ReactNode;
  className?: string;
  /** Where the block sits when it is shorter than the frame. */
  align?: "center" | "start";
}) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = frame.current;
    const inner = content.current;
    if (!outer || !inner) return;
    const fits = () =>
      inner.getBoundingClientRect().height <= outer.clientHeight + 0.5;
    const fit = () => {
      inner.style.zoom = "1";
      if (fits()) return;
      let low = FIT_FLOOR;
      let high = 1;
      for (let step = 0; step < 7; step++) {
        const zoom = (low + high) / 2;
        inner.style.zoom = String(zoom);
        if (fits()) low = zoom;
        else high = zoom;
      }
      inner.style.zoom = String(low);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frame}
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
        align === "center" ? "[justify-content:safe_center]" : ""
      } ${className}`}
    >
      <div ref={content} className="flex-none">
        {children}
      </div>
    </div>
  );
}

/**
 * The question's size: a lone question takes the stage; one that shares it
 * with a passage or another question steps down, and a long one steps down
 * again, so the frame is filled rather than overrun.
 */
function questionSize(text: string, tight: boolean) {
  if (tight)
    return text.length > 120
      ? "text-[clamp(1.375rem,min(2.3vw,4.3vh),2.875rem)] leading-[1.1]"
      : "text-[clamp(1.5rem,min(2.8vw,5.2vh),3.5rem)] leading-[1.06]";
  if (text.length > 150)
    return "text-[clamp(1.75rem,min(3.4vw,6vh),4.25rem)] leading-[1.08]";
  return "text-[clamp(2.25rem,min(4.6vw,8.5vh),6rem)] leading-[1.03] tracking-[-0.022em]";
}

/** Short answers sit two by two; long ones get a full line each. */
const LONG_OPTION = 34;

export function ScreenStage({ session }: { session: HostSession }) {
  const {
    lifecycle,
    questions,
    passage,
    displayMode,
    countdown,
    stats,
    totalQuestions,
    participantCount,
  } = session;
  const first = questions[0];
  const last = questions.at(-1);
  const tight = questions.length > 1 || Boolean(passage);
  const answered = questions.reduce(
    (sum, q) => sum + (stats[q.id]?.totalAnswered ?? 0),
    0,
  );
  const expected = participantCount * Math.max(1, questions.length);
  // How many have answered says nothing about which way they went, so it
  // shows in every display mode once answers open.
  const showProgress = lifecycle !== "DISPLAYED";
  const key = questions.map((q) => q.id).join("-");

  return (
    <ScreenShell session={session} tally="on-air">
      <div className="flex items-baseline justify-between gap-[3vw]">
        <p className="font-mono text-[clamp(1.125rem,2.6vh,2rem)] text-muted">
          <span className="text-foreground">
            {first && last && last.number > first.number
              ? `Questions ${first.number}–${last.number}`
              : `Question ${first?.number ?? "–"}`}
          </span>{" "}
          of {totalQuestions}
          {questions.length === 1 && first?.poll && (
            <span className="text-accent"> · Poll</span>
          )}
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
            ? "grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-[2.5vw]"
            : "flex flex-col"
        }`}
      >
        {passage && (
          <section
            aria-label="Passage"
            className="flex max-h-full min-h-0 flex-col self-start border border-border bg-surface px-[2vw] py-[2.5vh]"
          >
            <p className="label mb-[1.5vh] text-[clamp(0.75rem,1.5vh,1.125rem)]">
              Passage
            </p>
            <FitFrame align="start">
              <p className="max-w-[62ch] text-[clamp(1.125rem,min(1.7vw,3vh),2rem)] leading-[1.55] whitespace-pre-wrap text-foreground/90">
                {passage.text}
              </p>
            </FitFrame>
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
              className="flex min-h-0 flex-1 flex-col"
            >
              {questions.length === 0 ? (
                <p className="m-auto text-[clamp(1.25rem,3vh,2rem)] text-muted">
                  The next question is on its way…
                </p>
              ) : (
                <FitFrame align={passage ? "start" : "center"}>
                  <div className="flex flex-col gap-[4vh]">
                    {questions.map((question) => (
                      <ScreenQuestion
                        key={question.id}
                        question={question}
                        stats={stats[question.id] ?? emptyStats()}
                        tight={tight}
                        numbered={questions.length > 1}
                        countsVisible={
                          displayMode === "LIVE"
                            ? lifecycle !== "DISPLAYED"
                            : Boolean(stats[question.id]?.revealed)
                        }
                      />
                    ))}
                  </div>
                </FitFrame>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Always laid out, only faded in: if the row arrived with the timer,
          the stage above would shrink and reflow mid-question. */}
      <motion.div
        aria-hidden={!showProgress}
        className="mt-[3vh]"
        initial={false}
        animate={{ opacity: showProgress ? 1 : 0 }}
        transition={{ duration: duration.enter, ease: ease.out }}
      >
        <div className="mb-[1vh] flex justify-between font-mono text-[clamp(1rem,2.2vh,1.5rem)] text-muted">
          <span>
            <span className="text-foreground">{formatNumber(answered)}</span> of{" "}
            {formatNumber(expected)} answered
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
    </ScreenShell>
  );
}

function ScreenQuestion({
  question,
  stats,
  tight,
  numbered,
  countsVisible,
}: {
  question: StageQuestion;
  stats: QuestionStats;
  /** Shares the frame with a passage or another question. */
  tight: boolean;
  /** Several questions are up at once, so each says which it is. */
  numbered: boolean;
  countsVisible: boolean;
}) {
  const total = stats.totalAnswered;
  const oneColumn =
    tight && question.options.some((o) => o.text.length > LONG_OPTION);
  return (
    <section aria-label={`Question ${question.number}`}>
      <h2
        className={`display optical-start text-balance text-foreground ${questionSize(question.text, tight)}`}
      >
        {numbered && (
          <span className="mr-[0.5em] font-mono text-[0.6em] font-medium text-subtle">
            Q{question.number}
          </span>
        )}
        {question.text}
      </h2>
      <ul
        className={`grid ${oneColumn ? "grid-cols-1" : "grid-cols-2"} ${
          tight ? "mt-[3vh] gap-[1.2vh]" : "mt-[6vh] gap-[1.6vh]"
        }`}
      >
        {question.options.map((option, index) => {
          const count = stats.counts[option.id] ?? 0;
          return (
            <li key={option.id}>
              <AnswerOption
                index={index}
                text={option.text}
                size={tight ? "screen-sm" : "screen"}
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
          Final standings
        </h1>
        <FinalStandings
          entries={session.leaderboard}
          size="screen"
          pace="show"
        />
      </motion.div>
    </ScreenShell>
  );
}
