"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { TopBar } from "@/components/TopBar";
import { CountUp, RollingNumber } from "@/components/ui/AnimatedNumber";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Icon, type IconName } from "@/components/ui/Icon";
import { StatusScreen } from "@/components/ui/StatusScreen";
import { countNoun, ordinal } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { duration, ease, fade, rise, stageCut } from "@/lib/motion";
import { getStoredDisplayName } from "@/lib/session-storage";
import { AnswerOption, type OptionState } from "../components/AnswerOption";
import { CountdownBar, CountdownClock } from "../components/Countdown";
import { Leaderboard } from "../components/Leaderboard";
import { PassagePanel, SessionTopBar } from "../components/SessionChrome";
import { ScoringRules } from "../components/ScoringRules";
import { QuestionSlate, slateDetail } from "../components/Slate";
import { VERDICT_LABEL, verdictOf, type Verdict } from "../session-state";
import type { LeaderboardEntry, QuestionLifecycle } from "../session-types";
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

        {/* The status line sits on the same baseline as "players here". */}
        <div className="mt-12 flex [align-items:last_baseline] justify-between gap-6 border-t border-border pt-6">
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

        <ScoringRules
          rules={session.scoring}
          audience="player"
          className="mt-10 border-t border-border pt-6"
        />

        <p className="mt-10 text-sm text-subtle">
          Keep this screen open. Questions appear here the moment the host
          starts.
        </p>
        <Button
          variant="ghost"
          size="sm"
          icon="sign-out"
          className="mt-4 self-start ghost-flush-start"
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
  const verdictInView = useVerdictInView(
    reviewed ? questions.map((question) => question.id).join("-") : null,
  );

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
              {me &&
                (me.score > 0 ? (
                  <p className="text-sm text-muted">
                    You&apos;re{" "}
                    <span className="font-semibold text-foreground">
                      {ordinal(me.rank)}
                    </span>{" "}
                    of {leaderboard.length}
                  </p>
                ) : (
                  <p className="text-sm text-muted">No points yet</p>
                ))}
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
            last={Boolean(last && last.number >= totalQuestions)}
            summary={verdictInView ? null : reviewSummary(questions, me)}
            standingsUp={session.scene === "STANDINGS"}
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

/**
 * Whether any verdict banner is in sight between the sticky bars. The dock
 * repeats the verdict only once the banners have scrolled away, so the
 * screen never says it twice. `watch` changes when a new set of verdicts
 * lands; null while nothing is graded.
 */
function useVerdictInView(watch: string | null) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (watch === null) return;
    const banners = document.querySelectorAll("[data-verdict]");
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setInView(visible.size > 0);
      },
      // Clear of the top bar and question strip above, and the dock below.
      { rootMargin: "-104px 0px -96px 0px" },
    );
    banners.forEach((banner) => observer.observe(banner));
    return () => observer.disconnect();
  }, [watch]);
  return watch !== null && inView;
}

/**
 * The reveal, said in one line for the dock, where it stays in view however
 * far the questions above have scrolled: the verdict, the points, the rank.
 */
function reviewSummary(
  questions: PlayQuestion[],
  me: LeaderboardEntry | undefined,
): { verdict: Verdict; text: string } | null {
  if (questions.length === 0 || !questions.every((q) => q.stats.reviewed)) {
    return null;
  }
  const verdicts = questions.map((question) =>
    verdictOf({
      selected: question.selected,
      correctOptionIds: question.stats.correctOptionIds,
      earned: question.earned ?? 0,
      multiSelect: question.questionType === "MULTI_SELECT",
    }),
  );
  const earned = questions.reduce((sum, q) => sum + (q.earned ?? 0), 0);
  const verdict: Verdict =
    verdicts.length === 1
      ? verdicts[0]
      : verdicts.every((v) => v === "correct")
        ? "correct"
        : verdicts.every((v) => v === "none")
          ? "none"
          : earned > 0
            ? "partial"
            : "wrong";
  const parts = [
    VERDICT_LABEL[verdict],
    `${earned > 0 ? "+" : ""}${earned} pts`,
    me && me.score > 0 ? `${ordinal(me.rank)} overall` : null,
  ].filter(Boolean);
  return { verdict, text: parts.join(" · ") };
}

const SUMMARY_ICON: Record<
  Verdict,
  { name: IconName; className: string } | null
> = {
  correct: { name: "check", className: "text-success" },
  partial: { name: "check", className: "text-warning" },
  wrong: { name: "close", className: "text-danger" },
  none: null,
};

function Dock({
  lifecycle,
  last,
  summary,
  standingsUp,
  allLocked,
  lockableCount,
  multiple,
  pending,
  onLockIn,
}: {
  lifecycle: QuestionLifecycle;
  /** The final question is on screen. */
  last: boolean;
  /** The reveal in a line, once every question on screen is graded. */
  summary: { verdict: Verdict; text: string } | null;
  /** The host has the standings up on the big screen. */
  standingsUp: boolean;
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

  if (lifecycle === "REVIEWING" && summary) {
    const icon = SUMMARY_ICON[summary.verdict];
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${summary.text}-${standingsUp}`}
          {...fade}
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-center"
        >
          <p className="flex items-center gap-2 font-semibold text-foreground">
            {icon && (
              <Icon name={icon.name} size={16} className={icon.className} />
            )}
            {summary.text}
          </p>
          <p className="text-xs text-muted">
            {standingsUp
              ? "The standings are up on the big screen."
              : last
                ? "That was the last question. Final standings are next."
                : "Next question coming up."}
          </p>
        </motion.div>
      </AnimatePresence>
    );
  }

  const message =
    lifecycle === "DISPLAYED"
      ? "Read the question. Answers open when the host starts the timer."
      : lifecycle === "TIMED"
        ? "Locked in. Hang tight until time's up."
        : lifecycle === "FROZEN"
          ? "Time's up. Grading answers…"
          : standingsUp
            ? "The standings are up on the big screen."
            : last
              ? "That was the last question. Final standings are next."
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

const VERDICT_STYLE: Record<
  Verdict,
  { tone: string; icon: IconName | null; iconClass: string }
> = {
  correct: {
    tone: "border-success/50 bg-success/10",
    icon: "check",
    iconClass: "text-success",
  },
  partial: {
    tone: "border-warning/50 bg-warning/10",
    icon: "check",
    iconClass: "text-warning",
  },
  wrong: {
    tone: "border-danger/50 bg-danger/10",
    icon: "close",
    iconClass: "text-danger",
  },
  none: { tone: "border-border-strong bg-surface", icon: null, iconClass: "" },
};

/**
 * The moment of truth after each question: the verdict lands with a small
 * spring, and the points the server graded count up. The words match the
 * results page exactly, so an answer is never called two things.
 */
function ResultBanner({ question }: { question: PlayQuestion }) {
  const earned = question.earned ?? 0;
  const verdict = verdictOf({
    selected: question.selected,
    correctOptionIds: question.stats.correctOptionIds,
    earned,
    multiSelect: question.questionType === "MULTI_SELECT",
  });
  const style = VERDICT_STYLE[verdict];

  // The verdict lands in the hand on the same frame it lands on screen.
  useEffect(() => {
    if (verdict !== "none") haptics.result(earned > 0);
  }, [verdict, earned]);

  return (
    <motion.div
      role="status"
      data-verdict={verdict}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.stage, ease: ease.out }}
      className={`mt-5 flex items-center justify-between gap-4 border px-5 py-4 ${style.tone}`}
    >
      <p className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
        {style.icon && (
          <Icon name={style.icon} size={18} className={style.iconClass} />
        )}
        {VERDICT_LABEL[verdict]}
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
          <h1 className="display display-tight text-[clamp(2.5rem,9vw,3.75rem)] leading-[0.95] text-balance text-foreground">
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
  reason: "not-joined" | "missing" | "removed" | "unreachable";
  onRetry?: () => void;
}) {
  const copy = {
    "not-joined": {
      status: "Not joined",
      title: "You haven't joined this session",
      description: "Join with the code on the host's screen, then you're in.",
    },
    removed: {
      status: "Off air",
      title: "The host took you out of this session",
      description:
        "If that was a mistake, ask the host, then join again with the code on the big screen.",
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
