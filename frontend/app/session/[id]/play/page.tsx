"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getStoredAuthToken } from "@/lib/auth-storage";
import { useStompClient } from "@/hooks/useStompClient";
import Logo from "@/components/Logo";
import Spinner from "@/components/Spinner";
import LeaderboardRow from "@/components/ui/LeaderboardRow";
import { colorRgb, enterAnimation } from "@/lib/design-tokens";
import {
  formatTime,
  formatParticipantCount,
  normalizeCounts,
  normalizePoints,
  optionLabel,
} from "@/lib/session-utils";
import type {
  DisplayMode,
  LeaderboardEntry,
  PassageTimerMode,
  QuestionType,
  RejoinCurrentPassageQuestion,
  RejoinCurrentQuestion,
  RejoinResponse,
  ParticipantLeaderboardEntry,
} from "@/lib/types";

type SessionState = "LOBBY" | "ACTIVE" | "ENDED";
type QuestionLifecycle = "DISPLAYED" | "TIMED" | "FROZEN" | "REVIEWING";

interface ParticipantOption {
  id: number;
  text: string;
  orderIndex: number;
}

interface ParticipantQuestion {
  id: number;
  text: string;
  questionIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number;
  questionType: QuestionType;
  effectiveDisplayMode: DisplayMode;
  passageText: string | null;
  options: ParticipantOption[];
  selectedOptionIds: number[];
  lockedIn: boolean;
  counts: Record<number, number>;
  totalAnswered: number;
  totalLockedIn: number;
  correctOptionIds: number[];
  passageId: number | null;
  optionPoints: Record<number, number>;
  reviewed: boolean;
  revealed: boolean;
  reviewedAt: string | null;
}

interface SubQuestion {
  questionId: number;
  text: string;
  questionType: QuestionType;
  options: ParticipantOption[];
}

interface ParticipantPassage {
  id: number;
  text: string;
  timerMode: PassageTimerMode;
  questionIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number | null;
  effectiveDisplayMode: DisplayMode;
}

interface SessionQuestionDisplayedMsg {
  event: "QUESTION_DISPLAYED";
  questionId: number;
  text: string;
  questionType: QuestionType;
  options: Array<{ id: number; text: string; orderIndex: number }>;
  timeLimitSeconds: number;
  questionIndex: number;
  totalQuestions: number;
  passage: { id: number; text: string } | null;
  effectiveDisplayMode: DisplayMode;
}

interface SessionPassageDisplayedMsg {
  event: "PASSAGE_DISPLAYED";
  passageId: number;
  passageText: string;
  timeLimitSeconds: number | null;
  subQuestions: Array<{
    questionId: number;
    text: string;
    questionType: QuestionType;
    options: Array<{ id: number; text: string; orderIndex: number }>;
  }>;
  questionIndex: number;
  totalQuestions: number;
  effectiveDisplayMode: DisplayMode;
}

interface SessionTimerStartMsg {
  event: "TIMER_START";
  questionId: number | null;
  passageId: number | null;
  timeLimitSeconds: number;
}

interface SessionQuestionFrozenMsg {
  event: "QUESTION_FROZEN";
  questionId: number;
}

interface SessionPassageFrozenMsg {
  event: "PASSAGE_FROZEN";
  passageId: number;
  subQuestionIds: number[];
}

interface SessionQuestionReviewedMsg {
  event: "QUESTION_REVIEWED";
  questionId: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
}

interface SessionScoringCorrectedMsg {
  event: "SCORING_CORRECTED";
  questionId: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
}

interface SessionAnswerUpdateMsg {
  event: "ANSWER_UPDATE";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
  totalLockedIn: number;
}

interface SessionAnswerRevealMsg {
  event: "ANSWER_REVEAL";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
}

interface SessionParticipantLeaderboardMsg {
  event: "PARTICIPANT_LEADERBOARD";
  leaderboard: ParticipantLeaderboardEntry[];
  totalParticipants: number;
}

interface ParticipantJoinedMsg {
  event: "PARTICIPANT_JOINED";
  count: number;
}

interface SessionLeaderboardUpdateMsg {
  event: "LEADERBOARD_UPDATE";
  leaderboard: LeaderboardEntry[];
}

interface SessionAnswerAcceptedMsg {
  event: "ANSWER_ACCEPTED";
  clientRequestId: string;
  questionId: number;
  lockedIn: boolean;
}

interface SessionAnswerRejectedMsg {
  event: "ANSWER_REJECTED";
  clientRequestId: string;
  questionId: number;
  code: string;
  message: string;
  lockedIn: boolean;
}

interface SessionEndMsg {
  event: "SESSION_END";
  leaderboard?: LeaderboardEntry[];
  totalParticipants?: number;
}

type QuestionEventMsg =
  | SessionQuestionDisplayedMsg
  | SessionPassageDisplayedMsg
  | SessionTimerStartMsg
  | SessionQuestionFrozenMsg
  | SessionPassageFrozenMsg
  | SessionQuestionReviewedMsg
  | SessionScoringCorrectedMsg
  | SessionParticipantLeaderboardMsg
  | SessionEndMsg
  | ParticipantJoinedMsg;

type AnalyticsEventMsg =
  | SessionAnswerUpdateMsg
  | SessionAnswerRevealMsg
  | SessionLeaderboardUpdateMsg
  | SessionEndMsg;

type AnswerAckMsg = SessionAnswerAcceptedMsg | SessionAnswerRejectedMsg;

interface QuestionCardProps {
  question: ParticipantQuestion;
  lifecycle: QuestionLifecycle;
  onToggleOption: (questionId: number, optionId: number) => void;
  onLockIn: (questionId: number) => void;
}

function normalizeSelectionIds(selectedOptionIds: number[]) {
  return selectedOptionIds.toSorted((a, b) => a - b);
}

function createClientRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function formatQuestionSpanLabel(
  startIndex: number | null,
  endIndex: number | null,
  totalQuestions: number | null,
) {
  if (!startIndex || !totalQuestions) return "Waiting";
  if (!endIndex || endIndex <= startIndex) {
    return `Q${startIndex} of ${totalQuestions}`;
  }
  return `Q${startIndex}-Q${endIndex} of ${totalQuestions}`;
}

function sumQuestionPoints(question: ParticipantQuestion) {
  return Math.max(
    0,
    question.selectedOptionIds.reduce(
      (total, optionId) => total + (question.optionPoints[optionId] ?? 0),
      0,
    ),
  );
}

function buildQuestionFromDisplayed(
  question: SessionQuestionDisplayedMsg,
): ParticipantQuestion {
  return {
    id: question.questionId,
    text: question.text,
    questionIndex: question.questionIndex,
    totalQuestions: question.totalQuestions,
    timeLimitSeconds: question.timeLimitSeconds,
    questionType: question.questionType,
    effectiveDisplayMode: question.effectiveDisplayMode,
    passageId: question.passage?.id ?? null,
    passageText: question.passage?.text ?? null,
    options: question.options.toSorted(
      (a: { orderIndex: number }, b: { orderIndex: number }) =>
        a.orderIndex - b.orderIndex,
    ),
    selectedOptionIds: [],
    lockedIn: false,
    counts: {},
    totalAnswered: 0,
    totalLockedIn: 0,
    correctOptionIds: [],
    optionPoints: {},
    reviewed: false,
    revealed: false,
    reviewedAt: null,
  };
}

function buildQuestionFromPassageSubQuestion(
  question: SubQuestion,
  questionIndex: number,
  totalQuestions: number,
  passageText: string | null,
  timeLimitSeconds: number,
  effectiveDisplayMode: DisplayMode,
  passageId: number,
): ParticipantQuestion {
  return {
    id: question.questionId,
    text: question.text,
    questionIndex,
    totalQuestions,
    timeLimitSeconds,
    questionType: question.questionType,
    effectiveDisplayMode,
    passageId: passageId,
    passageText,
    options: question.options.toSorted(
      (a: ParticipantOption, b: ParticipantOption) =>
        a.orderIndex - b.orderIndex,
    ),
    selectedOptionIds: [],
    lockedIn: false,
    counts: {},
    totalAnswered: 0,
    totalLockedIn: 0,
    correctOptionIds: [],
    optionPoints: {},
    reviewed: false,
    revealed: false,
    reviewedAt: null,
  };
}

function buildQuestionFromRejoin(
  question: RejoinCurrentQuestion | RejoinCurrentPassageQuestion,
  totalQuestions: number,
  passageText: string | null,
  effectiveDisplayMode: DisplayMode,
  passageIdFromContext: number | null = null,
  timeLimitSecondsOverride?: number,
): ParticipantQuestion {
  const pId =
    passageIdFromContext ??
    ("passage" in question ? (question.passage?.id ?? null) : null);

  return {
    id: question.id,
    text: question.text,
    questionIndex: question.orderIndex,
    totalQuestions,
    timeLimitSeconds: timeLimitSecondsOverride ?? question.timeLimitSeconds,
    questionType: question.questionType,
    effectiveDisplayMode,
    passageId: pId,
    passageText,
    options: question.options.toSorted(
      (a: { orderIndex: number }, b: { orderIndex: number }) =>
        a.orderIndex - b.orderIndex,
    ),
    selectedOptionIds: question.selectedOptionIds,
    lockedIn: question.lockedIn,
    counts: {},
    totalAnswered: 0,
    totalLockedIn: question.lockedIn ? 1 : 0,
    correctOptionIds: [],
    optionPoints: {},
    reviewed: false,
    revealed: false,
    reviewedAt: null,
  };
}

function updateQuestion(
  prev: ParticipantQuestion[],
  questionId: number,
  patch: Partial<ParticipantQuestion>,
) {
  return prev.map((question) =>
    question.id === questionId ? { ...question, ...patch } : question,
  );
}

function setQuestionSelection(
  questions: ParticipantQuestion[],
  questionId: number,
  nextSelection: number[],
) {
  return questions.map((question) =>
    question.id === questionId
      ? { ...question, selectedOptionIds: nextSelection }
      : question,
  );
}

function currentQuestionLabel(
  question: ParticipantQuestion,
  lifecycle: QuestionLifecycle,
) {
  if (question.questionType === "MULTI_SELECT") {
    return lifecycle === "TIMED"
      ? `${question.selectedOptionIds.length} selected`
      : "Select all that apply";
  }
  return lifecycle === "TIMED"
    ? "Tap another option to change"
    : "Single choice";
}

function QuestionCard({
  question,
  lifecycle,
  onToggleOption,
  onLockIn,
}: QuestionCardProps) {
  const resolved = lifecycle === "REVIEWING" || question.reviewed;
  const interactive = lifecycle === "TIMED" && !question.lockedIn;
  const maxCount = Math.max(
    1,
    ...question.options.map((option) => question.counts[option.id] ?? 0),
  );
  const questionScore = resolved ? sumQuestionPoints(question) : null;

  return (
    <article className="border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="label tabular-nums">Q{question.questionIndex}</p>
            <span className="text-xs text-muted/40">·</span>
            <span className="text-xs text-muted tabular-nums">
              {question.timeLimitSeconds || 0}s
            </span>
            {question.questionType === "MULTI_SELECT" ? (
              <>
                <span className="text-xs text-muted/40">·</span>
                <span className="label text-accent">Multi-select</span>
              </>
            ) : null}
            {question.passageText ? (
              <>
                <span className="text-xs text-muted/40">·</span>
                <span className="label text-warning">Passage</span>
              </>
            ) : null}
          </div>
          <h2 className="max-w-3xl text-2xl font-bold leading-snug text-foreground">
            {question.text}
          </h2>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
          <span className="text-sm tabular-nums text-foreground">
            {question.totalAnswered} answered
          </span>
          {question.totalLockedIn > 0 ? (
            <span className="text-xs tabular-nums text-muted">
              {question.totalLockedIn} locked in
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {question.options.map((option, index) => {
          const meta = optionLabel(index);
          const count = question.counts[option.id] ?? 0;
          const isSelected = question.selectedOptionIds.includes(option.id);
          const isCorrect = question.correctOptionIds.includes(option.id);
          const isWrongSelected = resolved && isSelected && !isCorrect;
          const pointValue = question.optionPoints[option.id] ?? 0;
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

          const chosenCorrect = resolved && isCorrect && isSelected;
          const missedCorrect = resolved && isCorrect && !isSelected;

          const bgStyle = chosenCorrect
            ? `rgba(${colorRgb.success},0.15)`
            : missedCorrect
              ? `rgba(${colorRgb.success},0.06)`
              : isWrongSelected
                ? `rgba(${colorRgb.danger},0.1)`
                : isSelected
                  ? `rgba(${meta.rgb},0.14)`
                  : "var(--color-background)";

          const borderColor = chosenCorrect
            ? `rgba(${colorRgb.success},0.8)`
            : missedCorrect
              ? `rgba(${colorRgb.success},0.3)`
              : isWrongSelected
                ? `rgba(${colorRgb.danger},0.6)`
                : isSelected
                  ? meta.color
                  : "var(--color-border)";

          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-bold tracking-widest"
                    style={{
                      borderColor: borderColor,
                      color: chosenCorrect
                        ? "var(--color-success)"
                        : missedCorrect
                          ? `rgba(${colorRgb.success},0.55)`
                          : isWrongSelected
                            ? "var(--color-danger)"
                            : isSelected
                              ? meta.color
                              : "var(--color-muted)",
                    }}
                  >
                    {meta.letter}
                  </span>
                  <span className="min-w-0 text-sm text-foreground">
                    {option.text}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                  {interactive || resolved ? (
                    <span className="text-muted">{count}</span>
                  ) : null}
                  {resolved ? (
                    <span
                      className={`border px-2 py-1 ${
                        pointValue > 0
                          ? "border-success/25 text-success"
                          : pointValue < 0
                            ? "border-danger/25 text-danger"
                            : "border-border text-muted"
                      }`}
                    >
                      {pointValue > 0 ? `+${pointValue}` : pointValue}
                    </span>
                  ) : null}
                  {chosenCorrect ? (
                    <span className="text-success">✓</span>
                  ) : missedCorrect ? (
                    <span style={{ color: `rgba(${colorRgb.success},0.55)` }}>
                      ○
                    </span>
                  ) : isWrongSelected ? (
                    <span className="text-danger">✕</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden border border-border bg-background">
                <motion.div
                  className="h-full origin-left"
                  animate={{ scaleX: barWidth / 100 }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  style={{
                    backgroundColor:
                      resolved && isCorrect
                        ? "var(--color-success)"
                        : meta.color,
                    willChange: "transform",
                  }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                <span>{interactive ? "Tap to change" : "Locked"}</span>
                {resolved && isSelected && questionScore !== null ? (
                  <span className="tabular-nums text-foreground">
                    {questionScore > 0 ? `+${questionScore} pts` : "0 pts"}
                  </span>
                ) : null}
              </div>
            </>
          );

          const sharedClasses =
            "w-full border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

          if (interactive) {
            return (
              <motion.button
                key={option.id}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => onToggleOption(question.id, option.id)}
                className={sharedClasses}
                style={{
                  backgroundColor: bgStyle,
                  borderColor,
                }}
              >
                {content}
              </motion.button>
            );
          }

          return (
            <div
              key={option.id}
              className={`${sharedClasses} cursor-default`}
              style={{
                backgroundColor: bgStyle,
                borderColor,
                opacity: lifecycle === "DISPLAYED" ? 0.82 : 1,
              }}
            >
              {content}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted">
          {lifecycle === "DISPLAYED"
            ? "Waiting for host to start the timer."
            : lifecycle === "TIMED"
              ? currentQuestionLabel(question, lifecycle)
              : lifecycle === "FROZEN"
                ? "Time's up. Grading in progress."
                : resolved
                  ? `You scored ${questionScore ?? 0} points.`
                  : "Results loading..."}
        </p>

        {lifecycle === "TIMED" && !question.lockedIn ? (
          <button
            type="button"
            onClick={() => onLockIn(question.id)}
            disabled={question.selectedOptionIds.length === 0}
            className="border border-border px-4 py-2 text-xs tracking-widest uppercase text-muted transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Lock In
          </button>
        ) : question.lockedIn ? (
          <span className="label text-success">Locked</span>
        ) : null}
      </div>
    </article>
  );
}

export default function PlayPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();

  const [sessionState, setSessionState] = useState<SessionState>("LOBBY");
  const [questionLifecycle, setQuestionLifecycle] =
    useState<QuestionLifecycle>("DISPLAYED");
  const [sessionTitle, setSessionTitle] = useState("Live Session");
  const [participantCount, setParticipantCount] = useState(0);
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<ParticipantQuestion[]>([]);
  const [passage, setPassage] = useState<ParticipantPassage | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [participantLeaderboard, setParticipantLeaderboard] = useState<
    ParticipantLeaderboardEntry[]
  >([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState<LeaderboardEntry[]>(
    [],
  );
  const [rejoinToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`hermes_rejoin_${sessionId}`);
  });
  const [hydrated, setHydrated] = useState(() => rejoinToken === null);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "saving" | "retrying" | "error"
  >("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const timerRef = useRef<number | null>(null);
  const redirectRef = useRef(false);
  const pendingSelectionsRef = useRef(new Map<number, number[]>());
  const syncingQuestionPromisesRef = useRef(
    new Map<number, Promise<boolean>>(),
  );
  const pendingAckResolversRef = useRef(
    new Map<
      string,
      {
        resolve: (result: {
          success: boolean;
          code?: string;
          message?: string;
        }) => void;
        timeoutId: number;
      }
    >(),
  );

  const authToken = getStoredAuthToken();

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (seconds: number) => {
      stopTimer();
      setTimeLeft(seconds);
      timerRef.current = window.setInterval(() => {
        setTimeLeft((current) => {
          if (current === null || current <= 1) {
            stopTimer();
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    },
    [stopTimer],
  );

  const replaceQuestions = useCallback(
    (nextQuestions: ParticipantQuestion[]) => {
      setQuestions(nextQuestions);
    },
    [],
  );

  const applyQuestionPatch = useCallback(
    (questionId: number, patch: Partial<ParticipantQuestion>) => {
      setQuestions((current) => updateQuestion(current, questionId, patch));
    },
    [],
  );
  const loadSessionContext = useCallback(async () => {
    if (!sessionId || !rejoinToken) return;

    try {
      const response = await api.post<RejoinResponse>("/api/sessions/rejoin", {
        rejoinToken,
        sessionId: Number(sessionId),
      });

      if (!response.success) {
        if (response.error?.code === "NOT_FOUND") {
          localStorage.removeItem(`hermes_rejoin_${sessionId}`);
        }
        setHydrated(true);
        return;
      }

      const data = response.data;
      setParticipantId(data.participantId);
      setSessionTitle(data.sessionTitle || "Live Session");
      setParticipantCount(data.participantCount || 0);
      setSessionState((data.status as SessionState) || "LOBBY");
      setQuestionLifecycle(
        (data.questionLifecycle as QuestionLifecycle) || "DISPLAYED",
      );
      setTimeLeft(data.timeLeftSeconds ?? null);
      setLeaderboard([]);
      setParticipantLeaderboard([]);
      setFinalLeaderboard([]);

      if (data.currentPassage) {
        const currentPassage = data.currentPassage;
        setPassage({
          id: currentPassage.id,
          text: currentPassage.text,
          timerMode: currentPassage.timerMode,
          questionIndex: currentPassage.questionIndex,
          totalQuestions: currentPassage.totalQuestions,
          timeLimitSeconds: currentPassage.timeLimitSeconds,
          effectiveDisplayMode: currentPassage.effectiveDisplayMode,
        });
        replaceQuestions(
          currentPassage.subQuestions.map(
            (subQuestion: RejoinCurrentPassageQuestion) =>
              buildQuestionFromRejoin(
                subQuestion,
                currentPassage.totalQuestions,
                currentPassage.text,
                currentPassage.effectiveDisplayMode,
                currentPassage.id,
                currentPassage.timeLimitSeconds ?? subQuestion.timeLimitSeconds,
              ),
          ),
        );
      } else if (data.currentQuestion) {
        if (data.currentQuestion.passage) {
          setPassage({
            id: data.currentQuestion.passage.id,
            text: data.currentQuestion.passage.text,
            timerMode: data.currentQuestion.passage.timerMode,
            questionIndex: data.currentQuestion.orderIndex,
            totalQuestions: data.currentQuestion.totalQuestions,
            timeLimitSeconds: data.currentQuestion.timeLimitSeconds,
            effectiveDisplayMode: data.currentQuestion.effectiveDisplayMode,
          });
        } else {
          setPassage(null);
        }
        replaceQuestions([
          buildQuestionFromRejoin(
            data.currentQuestion,
            data.currentQuestion.totalQuestions,
            data.currentQuestion.passage?.text ?? null,
            data.currentQuestion.effectiveDisplayMode,
          ),
        ]);
      }

      setHydrated(true);
    } catch (_e) {
      // ignore
    }
  }, [sessionId, rejoinToken, replaceQuestions]);

  const handleStompConnect = useCallback(() => {
    void loadSessionContext();
  }, [loadSessionContext]);

  const { subscribe, unsubscribe, publish } = useStompClient({
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    onConnect: handleStompConnect,
  });

  useEffect(() => {
    if (!hydrated && rejoinToken) {
      const init = async () => {
        await loadSessionContext();
      };
      void init();
    }
  }, [hydrated, rejoinToken, loadSessionContext]);

  useEffect(() => {
    const pendingAckResolvers = pendingAckResolversRef.current;
    return () => {
      pendingAckResolvers.forEach(({ timeoutId, resolve }) => {
        window.clearTimeout(timeoutId);
        resolve({
          success: false,
          code: "CANCELLED",
          message: "Connection closed before the answer sync completed",
        });
      });
      pendingAckResolvers.clear();
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const questionDestination = `/topic/session.${sessionId}.question`;
    const answerQueueDestination = "/user/queue/answers";

    // Participants are unauthenticated — only subscribe to the open .question topic.
    // The backend also fans out PARTICIPANT_JOINED, ANSWER_UPDATE, and ANSWER_REVEAL
    // to .question so participants receive them without needing the auth-gated topics.
    subscribe(questionDestination, (msg) => {
      const data = msg as QuestionEventMsg | AnalyticsEventMsg;

      if (data.event === "QUESTION_DISPLAYED") {
        stopTimer();
        setSessionState("ACTIVE");
        setQuestionLifecycle("DISPLAYED");
        setLeaderboard([]);
        setParticipantLeaderboard([]);
        setFinalLeaderboard([]);
        setSyncStatus("idle");
        setSyncMessage("");
        setPassage(
          data.passage
            ? {
                id: data.passage.id,
                text: data.passage.text,
                timerMode: "PER_SUB_QUESTION",
                questionIndex: data.questionIndex,
                totalQuestions: data.totalQuestions,
                timeLimitSeconds: data.timeLimitSeconds,
                effectiveDisplayMode: data.effectiveDisplayMode,
              }
            : null,
        );
        const rejointQuestion = buildQuestionFromDisplayed(data);
        replaceQuestions([rejointQuestion]);
        setTimeLeft(0);
        return;
      }

      if (data.event === "PASSAGE_DISPLAYED") {
        stopTimer();
        setSessionState("ACTIVE");
        setQuestionLifecycle("DISPLAYED");
        setLeaderboard([]);
        setParticipantLeaderboard([]);
        setFinalLeaderboard([]);
        setSyncStatus("idle");
        setSyncMessage("");
        setPassage({
          id: data.passageId,
          text: data.passageText,
          timerMode: "ENTIRE_PASSAGE",
          questionIndex: data.questionIndex,
          totalQuestions: data.totalQuestions,
          timeLimitSeconds: null,
          effectiveDisplayMode: data.effectiveDisplayMode,
        });

        const nextQuestions = data.subQuestions.map(
          (
            question: {
              questionId: number;
              text: string;
              questionType: QuestionType;
              options: Array<{ id: number; text: string; orderIndex: number }>;
            },
            index: number,
          ) =>
            buildQuestionFromPassageSubQuestion(
              question,
              data.questionIndex + index,
              data.totalQuestions,
              data.passageText,
              data.timeLimitSeconds ?? 0,
              data.effectiveDisplayMode,
              data.passageId,
            ),
        );
        replaceQuestions(nextQuestions);
        setTimeLeft(0);
        return;
      }

      if (data.event === "SESSION_END") {
        stopTimer();
        setSessionState("ENDED");
        if ((data as SessionEndMsg).leaderboard) {
          setFinalLeaderboard((data as SessionEndMsg).leaderboard!);
        }
        return;
      }

      if (data.event === "TIMER_START") {
        setSessionState("ACTIVE");
        setQuestionLifecycle("TIMED");
        startTimer(data.timeLimitSeconds);
        return;
      }

      if (data.event === "QUESTION_FROZEN" || data.event === "PASSAGE_FROZEN") {
        stopTimer();
        setQuestionLifecycle("FROZEN");
        setTimeLeft(0);
        setQuestions((current) =>
          current.map((question) => {
            const shouldFreeze =
              data.event === "PASSAGE_FROZEN" ||
              question.id === (data as SessionQuestionFrozenMsg).questionId;
            return shouldFreeze ? { ...question, lockedIn: true } : question;
          }),
        );
        return;
      }

      if (
        data.event === "QUESTION_REVIEWED" ||
        data.event === "SCORING_CORRECTED"
      ) {
        setQuestionLifecycle("REVIEWING");
        applyQuestionPatch(data.questionId, {
          correctOptionIds: data.correctOptionIds,
          optionPoints: normalizePoints(data.optionPoints),
          reviewed: true,
          lockedIn: true,
        });
        return;
      }

      if (data.event === "PARTICIPANT_LEADERBOARD") {
        setParticipantLeaderboard(data.leaderboard);
        setLeaderboard(data.leaderboard);
        setParticipantCount(data.totalParticipants);
        return;
      }

      if (data.event === "PARTICIPANT_JOINED") {
        setParticipantCount(data.count);
        return;
      }

      if (data.event === "ANSWER_UPDATE") {
        applyQuestionPatch(data.questionId, {
          counts: normalizeCounts(data.counts),
          totalAnswered: data.totalAnswered,
          totalLockedIn: data.totalLockedIn,
        });
        return;
      }

      if (data.event === "ANSWER_REVEAL") {
        applyQuestionPatch(data.questionId, {
          counts: normalizeCounts(data.counts),
          totalAnswered: data.totalAnswered,
          revealed: true,
        });
        return;
      }
    });

    subscribe(answerQueueDestination, (msg) => {
      const data = msg as AnswerAckMsg;
      const pending = pendingAckResolversRef.current.get(data.clientRequestId);
      if (!pending) return;

      window.clearTimeout(pending.timeoutId);
      pendingAckResolversRef.current.delete(data.clientRequestId);

      if (data.event === "ANSWER_ACCEPTED") {
        pending.resolve({ success: true });
        return;
      }

      pending.resolve({
        success: false,
        code: data.code,
        message: data.message,
      });
    });

    return () => {
      unsubscribe(questionDestination);
      unsubscribe(answerQueueDestination);
    };
  }, [
    applyQuestionPatch,
    replaceQuestions,
    sessionId,
    startTimer,
    stopTimer,
    subscribe,
    unsubscribe,
  ]);

  useEffect(() => {
    if (sessionState !== "ENDED" || redirectRef.current) {
      return;
    }

    redirectRef.current = true;
    router.replace(`/session/${sessionId}/results`);
  }, [router, sessionId, sessionState]);

  const activePassage = passage;
  const activeQuestions = useMemo(
    () =>
      questions.filter((q) => {
        if (!activePassage) return !q.passageId;
        return q.passageId === activePassage.id;
      }),
    [questions, activePassage],
  );

  const isPassage = Boolean(activePassage);
  const maxQuestionIndex =
    activeQuestions[activeQuestions.length - 1]?.questionIndex ?? 0;
  const selectedQuestionCount = activeQuestions.reduce(
    (total, q) =>
      total + (q.lockedIn || q.selectedOptionIds.length > 0 ? 1 : 0),
    0,
  );
  const timerColour =
    timeLeft !== null && timeLeft > 0 && timeLeft <= 5
      ? "var(--color-danger)"
      : timeLeft !== null && timeLeft > 0 && timeLeft <= 10
        ? "var(--color-warning)"
        : "var(--color-foreground)";

  const leaderboardRows = useMemo(() => {
    const source = finalLeaderboard.length ? finalLeaderboard : leaderboard;
    return source.toSorted((a, b) => a.rank - b.rank);
  }, [finalLeaderboard, leaderboard]);

  const myLeaderboardEntry = useMemo(
    () =>
      participantId != null
        ? participantLeaderboard.find(
            (entry) => entry.participantId === participantId,
          )
        : null,
    [participantId, participantLeaderboard],
  );

  const topFive = leaderboardRows;
  const lockableQuestions = useMemo(
    () =>
      activeQuestions.filter(
        (q) =>
          questionLifecycle === "TIMED" &&
          !q.lockedIn &&
          q.selectedOptionIds.length > 0,
      ),
    [activeQuestions, questionLifecycle],
  );

  const canLockAll = lockableQuestions.length > 0;

  const waitForAnswerAck = useCallback((clientRequestId: string) => {
    return new Promise<{ success: boolean; code?: string; message?: string }>(
      (resolve) => {
        const timeoutId = window.setTimeout(() => {
          pendingAckResolversRef.current.delete(clientRequestId);
          resolve({
            success: false,
            code: "TIMEOUT",
            message: "Realtime confirmation timed out",
          });
        }, 2500);

        pendingAckResolversRef.current.set(clientRequestId, {
          resolve,
          timeoutId,
        });
      },
    );
  }, []);

  const fallbackSubmitAnswer = useCallback(
    async (questionId: number, selectedOptionIds: number[]) => {
      if (!sessionId || !rejoinToken) return false;
      setSyncStatus("retrying");
      setSyncMessage("Realtime save stalled. Retrying.");
      const response = await api.post<void>(
        `/api/sessions/${sessionId}/answers`,
        {
          rejoinToken,
          questionId,
          selectedOptionIds,
        },
      );
      if (!response.success) {
        setSyncStatus("error");
        setSyncMessage(response.error?.message ?? "Failed to save answer");
        void loadSessionContext();
        return false;
      }
      setSyncStatus("idle");
      setSyncMessage("");
      return true;
    },
    [loadSessionContext, rejoinToken, sessionId],
  );

  const fallbackLockIn = useCallback(
    async (questionId: number) => {
      if (!sessionId || !rejoinToken) return false;
      setSyncStatus("retrying");
      setSyncMessage("Realtime lock-in stalled. Retrying.");
      const response = await api.post<void>(
        `/api/sessions/${sessionId}/lock-in`,
        {
          rejoinToken,
          questionId,
        },
      );
      if (!response.success) {
        setSyncStatus("error");
        setSyncMessage(response.error?.message ?? "Failed to lock in answer");
        void loadSessionContext();
        return false;
      }
      setSyncStatus("idle");
      setSyncMessage("");
      return true;
    },
    [loadSessionContext, rejoinToken, sessionId],
  );

  const syncAnswerSelection = useCallback(
    async (questionId: number) => {
      if (!sessionId || !rejoinToken) return false;
      if (process.env.NODE_ENV === "development")
        console.info("[play] syncAnswerSelection:start", {
          questionId,
          hasRejoinToken: Boolean(rejoinToken),
          sessionId,
        });
      const existingPromise =
        syncingQuestionPromisesRef.current.get(questionId);
      if (existingPromise) {
        if (process.env.NODE_ENV === "development")
          console.info("[play] syncAnswerSelection:reuse-promise", {
            questionId,
          });
        return existingPromise;
      }

      const syncPromise = (async () => {
        try {
          while (true) {
            const queuedSelection =
              pendingSelectionsRef.current.get(questionId);
            if (!queuedSelection) {
              return true;
            }

            const clientRequestId = createClientRequestId();
            const ackPromise = waitForAnswerAck(clientRequestId);
            setSyncStatus("saving");
            setSyncMessage("Saving answer.");
            if (process.env.NODE_ENV === "development")
              console.info("[play] syncAnswerSelection:publish", {
                questionId,
                selectedOptionIds: queuedSelection,
                clientRequestId,
              });
            publish(`/app/session/${sessionId}/answer`, {
              rejoinToken,
              questionId,
              selectedOptionIds: queuedSelection,
              clientRequestId,
            });

            const ack = await ackPromise;
            if (!ack.success && ack.code === "TIMEOUT") {
              const fallbackSucceeded = await fallbackSubmitAnswer(
                questionId,
                queuedSelection,
              );
              if (!fallbackSucceeded) {
                pendingSelectionsRef.current.delete(questionId);
                return false;
              }
            } else if (!ack.success) {
              pendingSelectionsRef.current.delete(questionId);
              setSyncStatus("error");
              setSyncMessage(ack.message ?? "Failed to save answer");
              void loadSessionContext();
              return false;
            }

            const latestSelection =
              pendingSelectionsRef.current.get(questionId);
            if (
              latestSelection &&
              normalizeSelectionIds(latestSelection).join(",") !==
                normalizeSelectionIds(queuedSelection).join(",")
            ) {
              continue;
            }

            pendingSelectionsRef.current.delete(questionId);
            setSyncStatus("idle");
            setSyncMessage("");
            return true;
          }
        } finally {
          syncingQuestionPromisesRef.current.delete(questionId);
        }
      })();

      syncingQuestionPromisesRef.current.set(questionId, syncPromise);
      return syncPromise;
    },
    [
      fallbackSubmitAnswer,
      loadSessionContext,
      publish,
      rejoinToken,
      sessionId,
      waitForAnswerAck,
    ],
  );

  const handleToggleOption = useCallback(
    (questionId: number, optionId: number) => {
      if (questionLifecycle !== "TIMED" || !rejoinToken) return;

      const question = questions.find((entry) => entry.id === questionId);
      if (!question || question.lockedIn) return;

      const nextSelection =
        question.questionType === "MULTI_SELECT"
          ? question.selectedOptionIds.includes(optionId)
            ? question.selectedOptionIds.filter((id) => id !== optionId)
            : [...question.selectedOptionIds, optionId]
          : question.selectedOptionIds.includes(optionId)
            ? question.selectedOptionIds
            : [optionId];

      // No-op: re-selecting the already-selected option in single-select
      if (nextSelection === question.selectedOptionIds) return;

      setQuestions((current) =>
        setQuestionSelection(current, questionId, nextSelection),
      );

      pendingSelectionsRef.current.set(
        questionId,
        normalizeSelectionIds(nextSelection),
      );
      if (process.env.NODE_ENV === "development")
        console.info("[play] toggle-option", {
          questionId,
          optionId,
          nextSelection: normalizeSelectionIds(nextSelection),
        });
      void syncAnswerSelection(questionId);
    },
    [questionLifecycle, questions, rejoinToken, syncAnswerSelection],
  );

  const handleLockIn = useCallback(
    async (questionId: number) => {
      if (!rejoinToken) return;

      const question = questions.find((entry) => entry.id === questionId);
      if (
        !question ||
        question.lockedIn ||
        question.selectedOptionIds.length === 0
      ) {
        return;
      }

      pendingSelectionsRef.current.set(
        questionId,
        normalizeSelectionIds(question.selectedOptionIds),
      );
      setSyncStatus("saving");
      setSyncMessage("Saving answer.");
      const synced = await syncAnswerSelection(questionId);
      if (!synced) return;

      const clientRequestId = createClientRequestId();
      const ackPromise = waitForAnswerAck(clientRequestId);
      publish(`/app/session/${sessionId}/lock-in`, {
        rejoinToken,
        questionId,
        clientRequestId,
      });

      const ack = await ackPromise;
      if (!ack.success && ack.code === "TIMEOUT") {
        const fallbackSucceeded = await fallbackLockIn(questionId);
        if (!fallbackSucceeded) {
          return;
        }
      } else if (!ack.success) {
        setSyncStatus("error");
        setSyncMessage(ack.message ?? "Failed to lock in answer");
        void loadSessionContext();
        return;
      }

      setSyncStatus("idle");
      setSyncMessage("");
      setQuestions((current) =>
        current.map((currentQuestion) =>
          currentQuestion.id === questionId
            ? { ...currentQuestion, lockedIn: true }
            : currentQuestion,
        ),
      );
    },
    [
      fallbackLockIn,
      loadSessionContext,
      publish,
      questions,
      rejoinToken,
      sessionId,
      syncAnswerSelection,
      waitForAnswerAck,
    ],
  );

  const handleLockAll = useCallback(() => {
    lockableQuestions.forEach((question) => handleLockIn(question.id));
  }, [handleLockIn, lockableQuestions]);

  const handleLeave = useCallback(() => {
    localStorage.removeItem(`hermes_rejoin_${sessionId}`);
  }, [sessionId]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (sessionState === "LOBBY") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-4 sm:px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Logo size="sm" />
            <div className="flex items-center gap-3">
              <span className="label text-warning">Lobby</span>
              <span className="text-xs text-muted tabular-nums">
                {participantCount} participants
              </span>
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

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-muted">
              <span className="label">Live session</span>
              <span className="text-muted/40">·</span>
              <span className="tabular-nums">{participantCount} joined</span>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  if (sessionState === "ENDED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
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
    questionLifecycle === "REVIEWING" && activeQuestions.length === 1
      ? sumQuestionPoints(activeQuestions[0])
      : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-4">
          <Logo size="sm" />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="label">{headerStatus}</span>
            <div className="border border-border bg-surface px-4 py-2 text-right">
              <p className="label mb-1">Live audience</p>
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

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:px-6 py-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          <motion.section
            {...enterAnimation}
            className="border border-border bg-surface p-6"
          >
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

            <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
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
                  {formatTime(timeLeft ?? 0)}
                </div>
              </div>

              <div className="w-full max-w-sm">
                <div className="h-1 bg-border">
                  <motion.div
                    className="h-full origin-left"
                    animate={{
                      scaleX:
                        timeLeft !== null &&
                        activeQuestions[0]?.timeLimitSeconds
                          ? Math.max(
                              0,
                              timeLeft / activeQuestions[0].timeLimitSeconds,
                            )
                          : 0,
                    }}
                    transition={{ duration: 0.25 }}
                    style={{
                      backgroundColor: timerColour,
                      willChange: "transform",
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>{activePassage?.timerMode ?? "single question"}</span>
                  <span className="tabular-nums">
                    {activeQuestions[0].timeLimitSeconds || 0}s
                  </span>
                </div>
              </div>
            </div>
          </motion.section>

          {activePassage ? (
            <motion.section
              {...enterAnimation}
              className="border border-border bg-surface p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="label mb-2">Passage</p>
                  <div
                    className="prose prose-invert max-w-4xl text-lg leading-relaxed text-foreground prose-p:my-0 prose-p:leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: activePassage.text }}
                  />
                </div>
                <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-1">
                  <div className="border border-border bg-background px-4 py-3">
                    <p className="label mb-2">Active span</p>
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      Q{activePassage.questionIndex}
                      {maxQuestionIndex > activePassage.questionIndex
                        ? `-Q${maxQuestionIndex}`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted tabular-nums">
                      of {activePassage.totalQuestions} total questions
                    </p>
                  </div>
                  <div className="border border-border bg-background px-4 py-3">
                    <p className="label mb-2">Mode</p>
                    <p className="text-sm font-medium text-foreground">
                      {activePassage.timerMode === "ENTIRE_PASSAGE"
                        ? "All sub-questions together"
                        : "Passage stays pinned"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {activePassage.timerMode === "ENTIRE_PASSAGE"
                        ? "Answer any visible question in any order."
                        : "The passage remains fixed while each sub-question rotates below."}
                    </p>
                  </div>
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
                  <QuestionCard
                    question={question}
                    lifecycle={questionLifecycle}
                    onToggleOption={handleToggleOption}
                    onLockIn={handleLockIn}
                  />
                </motion.div>
              ))}
            </div>
          ) : activeQuestions[0] ? (
            <motion.div {...enterAnimation}>
              <QuestionCard
                question={activeQuestions[0]}
                lifecycle={questionLifecycle}
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
            className="border border-border bg-surface p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
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
              <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:min-w-[15rem]">
                <div className="border border-border bg-background px-4 py-3 text-right">
                  <p className="label mb-2">Ready</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">
                    {selectedQuestionCount}
                  </p>
                  <p className="mt-1 text-xs text-muted">with a selection</p>
                </div>
                <div className="border border-border bg-background px-4 py-3 text-right">
                  <p className="label mb-2">Visible</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">
                    {activeQuestions.length}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    question{activeQuestions.length === 1 ? "" : "s"} on screen
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {questionLifecycle === "TIMED" ? (
                <>
                  <button
                    type="button"
                    onClick={handleLockAll}
                    disabled={!canLockAll}
                    className="btn-primary"
                  >
                    {activePassage?.timerMode === "ENTIRE_PASSAGE"
                      ? "Lock In All"
                      : "Lock In"}
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
                    ? `You scored ${focusedScore} points on the current question.`
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
            className="border border-border bg-surface p-6"
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
                  {formatTime(timeLeft ?? 0)}
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
                    {sumQuestionPoints(activeQuestions[0]).toLocaleString()}
                  </div>
                  <p className="mt-2 text-xs text-muted">Points earned</p>
                </div>
                <span className="label text-success">
                  {activeQuestions[0].reviewed ? "Reviewed" : "Pending"}
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
