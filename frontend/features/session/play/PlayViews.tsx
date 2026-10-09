"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { TopBar } from "@/components/TopBar";
import { CountUp, RollingNumber } from "@/components/ui/AnimatedNumber";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { StatusScreen } from "@/components/ui/StatusScreen";
import { countNoun, ordinal } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { fade, rise, stageCut } from "@/lib/motion";
import { getStoredDisplayName } from "@/lib/session-storage";
import { AnswerOption, type OptionState } from "../components/AnswerOption";
import { CountdownBar, CountdownClock } from "../components/Countdown";
import { Leaderboard } from "../components/Leaderboard";
import { PassagePanel, SessionTopBar } from "../components/SessionChrome";
import { QuestionSlate, slateDetail } from "../components/Slate";
import type { QuestionLifecycle } from "../session-types";
import type { PlayQuestion } from "./play-state";
import type { PlaySession } from "./usePlaySession";

/* ── Lobby ────────────────────────────────────────────────────────────────── */

export function PlayLobby({
  session,
  sessionId,
}: {
  session: PlaySession;
  sessionId: string;
}) {
  const router = useRouter();
  const [confirmLeave, setConfirmLeave] = useState(false);
  // The player tree renders only in the browser, so storage is readable.
  const [name] = useState(() => getStoredDisplayName(sessionId));

  return (
    <>
      <SessionTopBar
        connected={session.connected}
        participantCount={session.participantCount}
        tally="standby"
      />
      <main
        id="main"
        className="mx-auto flex w-full max-w-xl flex-1 animate-rise flex-col justify-center px-4 py-12 sm:px-6"
      >
        <Badge tone="success" dot className="self-start">
          You&apos;re in
        </Badge>
        <h1 className="display display-tight mt-6 text-[clamp(2.75rem,11vw,4.5rem)] leading-[0.95] text-foreground">
          {name ? `Nice to see you, ${name}.` : "You're in."}
        </h1>
        {session.title && (
          <p className="mt-4 text-xl text-muted">{session.title}</p>
        )}

        <div className="mt-12 flex items-end justify-between gap-6 border-t border-border pt-6">
          <p className="flex items-center gap-2.5 text-foreground">
            <span aria-hidden className="live-dot text-accent" />
            Waiting for the host to start
          </p>
          <p className="flex shrink-0 flex-col items-end text-sm text-muted">
            <RollingNumber
              value={session.participantCount}
              className="font-mono text-3xl leading-none font-semibold text-foreground"
            />
            <span className="mt-1.5">
              {countNoun(session.participantCount, "player", "players")} here
            </span>
          </p>
        </div>

        <p className="mt-10 text-sm text-subtle">
          Keep this screen open. Questions appear here the moment the host
          starts.
        </p>
        <Button
          variant="ghost"
          size="sm"
          icon="sign-out"
          className="mt-4 self-start"
          onClick={() => setConfirmLeave(true)}
        >
          Leave session
        </Button>
      </main>

      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave this session?"
        description="To come back you'll need the code again, and you'll join as a new player."
        confirmLabel="Leave"
        onConfirm={() => {
          session.leave();
          router.push("/");
        }}
      />
    </>
  );
}

/* ── Live question ────────────────────────────────────────────────────────── */

function earnedPoints(question: PlayQuestion) {
  return Math.max(
    0,
    question.selected.reduce(
      (sum, id) => sum + (question.stats.optionPoints[id] ?? 0),
      0,
    ),
  );
}

function optionState(
  question: PlayQuestion,
  optionId: number,
): OptionState | undefined {
  const selected = question.selected.includes(optionId);
  if (question.stats.reviewed) {
    const correct = question.stats.correctOptionIds.includes(optionId);
    if (selected) return correct ? "correct" : "wrong";
    return correct ? "missed" : "dimmed";
  }
  return selected ? "selected" : undefined;
}

export function PlayStage({ session }: { session: PlaySession }) {
  const {
    lifecycle,
    questions,
    passage,
    countdown,
    totalQuestions,
    lockPending,
    lockable,
    leaderboard,
    participantId,
    sync,
  } = session;
  const first = questions[0];
  const last = questions.at(-1);
  const reviewed = lifecycle === "REVIEWING";
  const me = leaderboard.find((entry) => entry.participantId === participantId);
  const anyPending = Object.keys(lockPending).length > 0;
  const allLocked =
    questions.length > 0 && questions.every((question) => question.lockedIn);

  return (
    <>
      <SessionTopBar
        connected={session.connected}
        participantCount={session.participantCount}
        tally="on-air"
      />
      <div className="chrome sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-[var(--z-raised)] border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <p className="text-sm text-muted">
            <span className="font-mono text-foreground">
              {first && last && last.number > first.number
                ? `Q${first.number}–${last.number}`
                : `Q${first?.number ?? "–"}`}
            </span>{" "}
            of {totalQuestions}
          </p>
          <CountdownClock
            countdown={countdown}
            lifecycle={lifecycle}
            className="text-2xl"
          />
        </div>
        <CountdownBar countdown={countdown} lifecycle={lifecycle} />
      </div>

      <main
        id="main"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pt-6 pb-10 sm:px-6"
      >
        {passage && <PassagePanel text={passage.text} />}

        <div className="relative">
          {first && last && (
            <QuestionSlate
              key={questions.map((question) => question.id).join("-")}
              lifecycle={lifecycle}
              first={first.number}
              last={last.number}
              total={totalQuestions}
              detail={slateDetail(questions)}
              size="compact"
            />
          )}

          {/* The next question starts from the top, not wherever the last one
            was scrolled to. */}
          {/* popLayout, not wait: the new question mounts at once, so the
              area under the slate reaches its final height in the slate's
              first frame instead of resizing mid-drop and jolting it. */}
          <AnimatePresence
            mode="popLayout"
            initial={false}
            onExitComplete={() => window.scrollTo(0, 0)}
          >
            <motion.div
              key={questions.map((question) => question.id).join("-")}
              {...stageCut}
              className="flex flex-col gap-10"
            >
              {questions.length === 0 ? (
                <p className="py-16 text-center text-muted">
                  The next question is on its way…
                </p>
              ) : (
                questions.map((question) => (
                  <PlayQuestionBlock
                    key={question.id}
                    question={question}
                    lifecycle={lifecycle}
                    showNumber={questions.length > 1}
                    pending={Boolean(lockPending[question.id])}
                    onToggle={(optionId) =>
                      session.toggleOption(question.id, optionId)
                    }
                  />
                ))
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {reviewed && leaderboard.length > 0 && (
          <motion.section
            {...rise}
            aria-labelledby="standings-heading"
            className="mt-6 border border-border bg-surface p-5"
          >
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2
                id="standings-heading"
                className="text-base font-semibold text-foreground"
              >
                Standings
              </h2>
              {me && (
                <p className="text-sm text-muted">
                  You&apos;re{" "}
                  <span className="font-semibold text-foreground">
                    {ordinal(me.rank)}
                  </span>{" "}
                  of {leaderboard.length}
                </p>
              )}
            </div>
            <Leaderboard entries={leaderboard} meId={participantId} limit={5} />
          </motion.section>
        )}
      </main>

      <div className="chrome dock-inset sticky bottom-0 z-[var(--z-dock)] border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3 sm:px-6">
          {sync.status !== "idle" && sync.message && (
            <p
              role={sync.status === "error" ? "alert" : "status"}
              className={`text-sm ${sync.status === "error" ? "text-danger" : "text-muted"}`}
            >
              {sync.message}
            </p>
          )}
          <Dock
            lifecycle={lifecycle}
            allLocked={allLocked}
            lockableCount={lockable.length}
            multiple={questions.length > 1}
            pending={anyPending}
            onLockIn={() => {
              haptics.commit();
              session.lockAll();
            }}
          />
        </div>
      </div>
    </>
  );
}

function Dock({
  lifecycle,
  allLocked,
  lockableCount,
  multiple,
  pending,
  onLockIn,
}: {
  lifecycle: QuestionLifecycle;
  allLocked: boolean;
  lockableCount: number;
  multiple: boolean;
  pending: boolean;
  onLockIn: () => void;
}) {
  if (lifecycle === "TIMED" && !allLocked) {
    return (
      <Button
        variant="primary"
        size="lg"
        icon="lock"
        className="w-full"
        disabled={lockableCount === 0 && !pending}
        pending={pending}
        onClick={onLockIn}
      >
        {pending
          ? "Locking in…"
          : multiple && lockableCount > 1
            ? `Lock in ${lockableCount} answers`
            : "Lock in"}
      </Button>
    );
  }

  const message =
    lifecycle === "DISPLAYED"
      ? "Read the question. Answers open when the host starts the timer."
      : lifecycle === "TIMED"
        ? "Locked in. Hang tight until time's up."
        : lifecycle === "FROZEN"
          ? "Time's up. Grading answers…"
          : "Next question coming up. Keep this screen open.";

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={message}
        {...fade}
        className="flex min-h-12 items-center justify-center gap-2 text-center text-sm text-muted"
      >
        {lifecycle === "TIMED" && (
          <Icon name="lock" size={15} className="text-success" />
        )}
        {message}
      </motion.p>
    </AnimatePresence>
  );
}

function PlayQuestionBlock({
  question,
  lifecycle,
  showNumber,
  pending,
  onToggle,
}: {
  question: PlayQuestion;
  lifecycle: QuestionLifecycle;
  showNumber: boolean;
  pending: boolean;
  onToggle: (optionId: number) => void;
}) {
  const multi = question.questionType === "MULTI_SELECT";
  const interactive = lifecycle === "TIMED" && !question.lockedIn && !pending;
  const reviewed = question.stats.reviewed;

  return (
    <section aria-label={`Question ${question.number}`}>
      <h2 className="display text-[clamp(1.625rem,6.2vw,2.25rem)] leading-[1.1] text-foreground">
        {showNumber && (
          <span className="mr-2 font-mono text-base font-medium text-subtle">
            Q{question.number}
          </span>
        )}
        {question.text}
      </h2>
      <p className="mt-2 flex items-center gap-2 text-sm text-subtle">
        {multi ? "Pick every answer you think is right" : "Pick one answer"}
        {question.lockedIn && !reviewed && (
          <Badge tone="success" className="ml-1">
            Locked
          </Badge>
        )}
      </p>

      <div
        role={multi ? "group" : "radiogroup"}
        aria-label={`Answers for question ${question.number}`}
        className="mt-5 grid gap-2.5 sm:grid-cols-2"
      >
        {question.options.map((option, index) => (
          <AnswerOption
            key={option.id}
            index={index}
            text={option.text}
            size="lg"
            state={optionState(question, option.id)}
            role={multi ? "checkbox" : "radio"}
            locked={question.lockedIn && !reviewed}
            onPress={() => {
              haptics.select();
              onToggle(option.id);
            }}
            disabled={!interactive}
          />
        ))}
      </div>

      <AnimatePresence>
        {reviewed && <ResultBanner question={question} />}
      </AnimatePresence>
    </section>
  );
}

/**
 * The moment of truth after each question: the verdict lands with a small
 * spring, and the points count up.
 */
function ResultBanner({ question }: { question: PlayQuestion }) {
  const earned = earnedPoints(question);
  const answered = question.selected.length > 0;

  // The verdict lands in the hand on the same frame it lands on screen.
  useEffect(() => {
    if (answered) haptics.result(earned > 0);
  }, [answered, earned]);
  const tone = !answered
    ? "border-border-strong bg-surface"
    : earned > 0
      ? "border-success/50 bg-success/10"
      : "border-danger/50 bg-danger/10";

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={`mt-5 flex items-center justify-between gap-4 border px-5 py-4 ${tone}`}
    >
      <p className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
        {answered && (
          <Icon
            name={earned > 0 ? "check" : "close"}
            size={18}
            className={earned > 0 ? "text-success" : "text-danger"}
          />
        )}
        {!answered
          ? "No answer this time"
          : earned > 0
            ? "Nice one"
            : "Not this time"}
      </p>
      <p className="font-mono text-2xl font-semibold text-foreground">
        {earned > 0 ? "+" : ""}
        <CountUp value={earned} seconds={0.7} />
        <span className="ml-1.5 text-sm font-medium text-subtle">pts</span>
      </p>
    </motion.div>
  );
}

/* ── Other states ─────────────────────────────────────────────────────────── */

export function PlayEnded() {
  return (
    <>
      <TopBar home={null} width="stage" />
      <main id="main" className="flex flex-1 items-center justify-center px-4">
        <div
          role="status"
          className="flex animate-fade flex-col items-center gap-4 text-center"
        >
          <h1 className="display text-4xl text-foreground">
            That&apos;s the end of the quiz
          </h1>
          <p className="flex items-center gap-2.5 text-muted">
            <span aria-hidden className="live-dot text-accent" />
            Adding up your results…
          </p>
        </div>
      </main>
    </>
  );
}

/** For a device that is not, or is no longer, a player in this session. */
export function PlayUnavailable({
  reason,
  onRetry,
}: {
  reason: "not-joined" | "missing" | "unreachable";
  onRetry?: () => void;
}) {
  const copy = {
    "not-joined": {
      status: "Not joined",
      title: "You haven't joined this session",
      description: "Join with the code on the host's screen, then you're in.",
    },
    missing: {
      status: "Off air",
      title: "This session isn't running any more",
      description:
        "The host ended or discarded it. If they've started a new one, join with the new code.",
    },
    unreachable: {
      status: "Signal lost",
      title: "Can't reach the session",
      description:
        "Check your connection. We'll keep trying, and your answers so far are safe.",
    },
  }[reason];

  return (
    <>
      <TopBar width="stage" />
      <main id="main" className="flex flex-1 flex-col">
        <StatusScreen
          status={copy.status}
          statusTone={reason === "unreachable" ? "warning" : "neutral"}
          title={copy.title}
          description={copy.description}
          actions={
            reason === "unreachable" && onRetry ? (
              <Button variant="primary" icon="refresh" onClick={onRetry}>
                Try again
              </Button>
            ) : (
              <ButtonLink
                href="/join"
                variant="primary"
                trailingIcon="arrow-right"
              >
                Join a session
              </ButtonLink>
            )
          }
        />
      </main>
    </>
  );
}
