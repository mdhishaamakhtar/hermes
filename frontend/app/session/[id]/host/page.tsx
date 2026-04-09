"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { sessionsApi } from "@/lib/apiClient";
import { getStoredAuthToken } from "@/lib/auth-storage";
import { useStompClient } from "@/hooks/useStompClient";
import Logo from "@/components/Logo";
import LeaderboardRow from "@/components/ui/LeaderboardRow";
import { OPTION_META } from "@/lib/session-constants";
import { colorRgb, enterAnimation } from "@/lib/design-tokens";
import type {
  DisplayMode,
  PassageTimerMode,
  SessionResults,
} from "@/lib/types";

type SessionStatus = "LOBBY" | "ACTIVE" | "ENDED";
type QuestionLifecycle = "DISPLAYED" | "TIMED" | "FROZEN" | "REVIEWING";

interface ActiveOption {
  id: number;
  text: string;
  orderIndex: number;
}

interface ActiveQuestion {
  id: number;
  text: string;
  questionType: string;
  orderIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number;
  effectiveDisplayMode: DisplayMode;
  passage: { id: number; text: string } | null;
  options: ActiveOption[];
}

interface ActivePassage {
  id: number;
  text: string;
  timerMode: PassageTimerMode;
  questionIndex: number;
  totalQuestions: number;
  effectiveDisplayMode: DisplayMode;
  subQuestions: ActiveQuestion[];
}

interface QuestionStats {
  counts: Record<number, number>;
  totalAnswered: number;
  totalLockedIn: number;
  totalParticipants: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
  revealed: boolean;
  reviewed: boolean;
}

interface LiveLeaderboardEntry {
  rank: number;
  participantId: number;
  displayName: string;
  score: number;
}

interface QuestionDisplayedMsg {
  event: "QUESTION_DISPLAYED";
  questionId: number;
  text: string;
  questionType: string;
  options: ActiveOption[];
  timeLimitSeconds: number;
  questionIndex: number;
  totalQuestions: number;
  passage: { id: number; text: string } | null;
  effectiveDisplayMode: DisplayMode;
}

interface PassageDisplayedMsg {
  event: "PASSAGE_DISPLAYED";
  passageId: number;
  passageText: string;
  subQuestions: Array<{
    questionId: number;
    text: string;
    questionType: string;
    options: ActiveOption[];
  }>;
  questionIndex: number;
  totalQuestions: number;
  effectiveDisplayMode: DisplayMode;
}

interface TimerStartMsg {
  event: "TIMER_START";
  questionId: number | null;
  passageId: number | null;
  timeLimitSeconds: number;
}

interface QuestionFrozenMsg {
  event: "QUESTION_FROZEN";
  questionId: number;
}

interface PassageFrozenMsg {
  event: "PASSAGE_FROZEN";
  passageId: number;
  subQuestionIds: number[];
}

interface QuestionReviewedMsg {
  event: "QUESTION_REVIEWED";
  questionId: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
}

interface ScoringCorrectedMsg {
  event: "SCORING_CORRECTED";
  questionId: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
}

interface AnswerUpdateMsg {
  event: "ANSWER_UPDATE";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
  totalLockedIn: number;
}

interface AnswerRevealMsg {
  event: "ANSWER_REVEAL";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
}

interface LeaderboardUpdateMsg {
  event: "LEADERBOARD_UPDATE";
  leaderboard: LiveLeaderboardEntry[];
}

interface ParticipantLeaderboardMsg {
  event: "PARTICIPANT_LEADERBOARD";
  top: Array<{ rank: number; displayName: string; score: number }>;
  totalParticipants: number;
}

interface SessionEndMsg {
  event: "SESSION_END";
  leaderboard?: LiveLeaderboardEntry[];
  totalParticipants?: number;
}

interface QuestionCardOption {
  id: number;
  text: string;
  orderIndex: number;
  count: number;
  isCorrect: boolean;
  pointValue: number;
}

interface QuestionCardData {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  totalAnswers: number;
  totalLockedIn?: number;
  totalParticipants?: number;
  options: QuestionCardOption[];
  passageText?: string | null;
}

interface CorrectionDraftOption {
  optionId: number;
  text: string;
  orderIndex: number;
  pointValue: string;
}

const DEFAULT_STATS = (): QuestionStats => ({
  counts: {},
  totalAnswered: 0,
  totalLockedIn: 0,
  totalParticipants: 0,
  correctOptionIds: [],
  optionPoints: {},
  revealed: false,
  reviewed: false,
});

function normalizeCounts(
  counts: Record<string, number> | Record<number, number>,
) {
  return Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [Number(key), Number(value)]),
  ) as Record<number, number>;
}

function normalizePoints(points: Record<string | number, number>) {
  return Object.fromEntries(
    Object.entries(points).map(([key, value]) => [Number(key), Number(value)]),
  ) as Record<number, number>;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function displayModeLabel(mode: DisplayMode) {
  return mode.replace("_", " ");
}

function updateStats(
  prev: Record<number, QuestionStats>,
  questionId: number,
  patch: Partial<QuestionStats>,
): Record<number, QuestionStats> {
  const current = prev[questionId] ?? DEFAULT_STATS();
  return {
    ...prev,
    [questionId]: {
      ...current,
      ...patch,
      counts: patch.counts ? patch.counts : current.counts,
      correctOptionIds:
        patch.correctOptionIds ?? current.correctOptionIds ?? [],
      optionPoints: patch.optionPoints
        ? patch.optionPoints
        : current.optionPoints,
    },
  };
}

function buildActiveQuestionCard(
  question: ActiveQuestion,
  stats: QuestionStats | undefined,
  passageText?: string | null,
): QuestionCardData {
  const normalized = stats ?? DEFAULT_STATS();
  const counts = normalized.counts;
  const pointMap = normalized.optionPoints;
  const totalAnswers = normalized.totalAnswered;

  return {
    id: question.id,
    text: question.text,
    orderIndex: question.orderIndex,
    timeLimitSeconds: question.timeLimitSeconds,
    totalAnswers,
    totalLockedIn: normalized.totalLockedIn,
    totalParticipants: normalized.totalParticipants,
    passageText,
    options: question.options
      .toSorted((a, b) => a.orderIndex - b.orderIndex)
      .map((option) => ({
        id: option.id,
        text: option.text,
        orderIndex: option.orderIndex,
        count: counts[option.id] ?? 0,
        isCorrect: (normalized.correctOptionIds ?? []).includes(option.id),
        pointValue: pointMap[option.id] ?? 0,
      })),
  };
}

function buildResultsQuestionCard(
  question: SessionResults["questions"][number],
): QuestionCardData {
  const totalAnswers = question.totalAnswers;

  return {
    id: question.id,
    text: question.text,
    orderIndex: question.orderIndex,
    timeLimitSeconds: question.timeLimitSeconds,
    totalAnswers,
    options: question.options
      .toSorted((a, b) => a.orderIndex - b.orderIndex)
      .map((option) => ({
        id: option.id,
        text: option.text,
        orderIndex: option.orderIndex,
        count: option.count,
        isCorrect: option.isCorrect,
        pointValue: option.pointValue,
      })),
  };
}

function CardBadge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "success" | "warning" | "accent" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/30 text-success"
      : tone === "warning"
        ? "border-warning/30 text-warning"
        : tone === "accent"
          ? "border-primary/30 text-accent"
          : tone === "danger"
            ? "border-danger/30 text-danger"
            : "border-border text-muted";

  return (
    <span
      className={`inline-flex items-center border px-2 py-1 text-[11px] tracking-[0.18em] uppercase ${toneClass}`}
    >
      {children}
    </span>
  );
}

function QuestionCard({
  question,
  mode,
  onEdit,
}: {
  question: QuestionCardData;
  mode: "display" | "timed-live" | "timed-summary" | "review";
  onEdit?: () => void;
}) {
  const showMetrics = mode !== "display";
  const maxCount = Math.max(
    1,
    ...question.options.map((option) => option.count),
  );

  return (
    <article className="border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="label tabular-nums">Q{question.orderIndex}</p>
            <span className="text-xs text-muted/50">·</span>
            <span className="text-xs text-muted tabular-nums">
              {question.timeLimitSeconds}s time limit
            </span>
            {question.passageText ? (
              <CardBadge tone="accent">Passage</CardBadge>
            ) : null}
          </div>
          <h2 className="text-2xl font-bold leading-snug text-foreground">
            {question.text}
          </h2>
          {question.passageText ? (
            <p className="mt-3 max-w-3xl text-sm text-muted">
              {question.passageText}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-start gap-3">
          {showMetrics ? (
            <div className="text-right">
              <div className="text-sm tabular-nums text-foreground">
                {question.totalAnswers} answered
              </div>
              {question.totalLockedIn !== undefined ? (
                <div className="text-xs text-muted tabular-nums">
                  {question.totalLockedIn} locked in
                </div>
              ) : null}
            </div>
          ) : null}

          {onEdit ? (
            <button
              onClick={onEdit}
              className="border border-border px-4 py-2 text-xs tracking-widest uppercase text-muted transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Edit scoring
            </button>
          ) : null}
        </div>
      </div>

      {mode === "display" ? (
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {question.options.map((option, index) => {
            const meta = OPTION_META[index % OPTION_META.length];
            return (
              <div
                key={option.id}
                className="border border-border px-4 py-3 text-sm text-foreground"
              >
                <span
                  className="mr-3 inline-flex h-6 w-6 items-center justify-center border text-[11px] font-bold tracking-widest"
                  style={{
                    borderColor: `${meta.color}55`,
                    color: meta.color,
                  }}
                >
                  {meta.letter}
                </span>
                <span className="align-middle">{option.text}</span>
              </div>
            );
          })}
        </div>
      ) : mode === "timed-summary" ? (
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {question.options.map((option, index) => {
            const meta = OPTION_META[index % OPTION_META.length];
            return (
              <div
                key={option.id}
                className="border border-border bg-background px-4 py-3 text-sm text-foreground"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center border text-[11px] font-bold tracking-widest"
                    style={{
                      borderColor: `${meta.color}55`,
                      color: meta.color,
                    }}
                  >
                    {meta.letter}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {question.options.map((option, index) => {
            const meta = OPTION_META[index % OPTION_META.length];
            const pct = (option.count / maxCount) * 100;

            return (
              <div key={option.id}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center border text-[11px] font-bold tracking-widest"
                      style={{
                        borderColor: `${meta.color}55`,
                        color: meta.color,
                      }}
                    >
                      {meta.letter}
                    </span>
                    <span className="min-w-0 truncate text-sm text-foreground">
                      {option.text}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs tabular-nums">
                    <span
                      className={
                        option.isCorrect ? "text-success" : "text-muted"
                      }
                    >
                      {option.count}
                    </span>
                    {mode === "review" ? (
                      <span
                        className={`border px-2 py-1 ${
                          option.pointValue > 0
                            ? "border-success/25 text-success"
                            : option.pointValue < 0
                              ? "border-danger/25 text-danger"
                              : "border-border text-muted"
                        }`}
                      >
                        {option.pointValue > 0
                          ? `+${option.pointValue}`
                          : option.pointValue}
                      </span>
                    ) : null}
                    {option.isCorrect ? (
                      <span className="text-success">✓</span>
                    ) : null}
                  </div>
                </div>
                <div className="h-3 bg-background overflow-hidden border border-border">
                  <motion.div
                    initial={mode === "review" ? { scaleX: 0 } : false}
                    animate={{ scaleX: pct / 100 }}
                    transition={{
                      type: "spring",
                      stiffness: 240,
                      damping: 30,
                    }}
                    className="h-full origin-left"
                    style={{
                      backgroundColor: option.isCorrect
                        ? "var(--color-success)"
                        : meta.color,
                      willChange: "transform",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function ScoringDrawer({
  open,
  questionTitle,
  draftOptions,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  questionTitle: string;
  draftOptions: CorrectionDraftOption[];
  saving: boolean;
  onClose: () => void;
  onChange: (index: number, value: string) => void;
  onSave: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div {...enterAnimation} className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close scoring editor"
            onClick={onClose}
            className="absolute inset-0 bg-black/55"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-border bg-background shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="border-b border-border px-6 py-5">
                <p className="label mb-2">Edit scoring</p>
                <h3 className="text-xl font-bold leading-snug text-foreground">
                  {questionTitle}
                </h3>
                <p className="mt-3 text-sm text-muted">
                  Positive point values count as correct. Zero or negative
                  values are treated as incorrect for display and scoring.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-4">
                  {draftOptions.map((option, index) => (
                    <label key={option.optionId} className="block">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {option.text}
                        </span>
                        <span className="text-xs text-muted tabular-nums">
                          Option {index + 1}
                        </span>
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={option.pointValue}
                        onChange={(event) =>
                          onChange(index, event.target.value)
                        }
                        className="input-field"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-border px-6 py-5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="border border-border px-5 py-3 text-xs tracking-widest uppercase text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? "Saving..." : "Save & Recalculate"}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function HostPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("LOBBY");
  const [questionLifecycle, setQuestionLifecycle] =
    useState<QuestionLifecycle>("DISPLAYED");
  const [joinCode, setJoinCode] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(`hermes_session_${id}`) || "";
  });
  const [participantCount, setParticipantCount] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(
    null,
  );
  const [activePassage, setActivePassage] = useState<ActivePassage | null>(
    null,
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [effectiveDisplayMode, setEffectiveDisplayMode] =
    useState<DisplayMode>("LIVE");
  const [timerLimitSeconds, setTimerLimitSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionStatsById, setQuestionStatsById] = useState<
    Record<number, QuestionStats>
  >({});
  const [leaderboard, setLeaderboard] = useState<LiveLeaderboardEntry[]>([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState<
    { rank: number; displayName: string; score: number }[] | null
  >(null);
  const [sessionResults, setSessionResults] = useState<SessionResults | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [loadingAction, setLoadingAction] = useState<
    | "start-session"
    | "start-timer"
    | "end-timer"
    | "next"
    | "end-session"
    | null
  >(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [scoringQuestionId, setScoringQuestionId] = useState<number | null>(
    null,
  );
  const [scoringQuestionTitle, setScoringQuestionTitle] = useState("");
  const [scoringDraft, setScoringDraft] = useState<CorrectionDraftOption[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const authToken = getStoredAuthToken();

  const loadResults = useCallback(async () => {
    if (!id) return;
    const response = await api.get<SessionResults>(
      `/api/sessions/${id}/results`,
    );
    if (response.success) {
      setSessionResults(response.data);
      setFinalLeaderboard(response.data.leaderboard);
    }
  }, [id]);

  const loadSessionContext = useCallback(async () => {
    if (!id) return;

    const [lobbyResponse, statusResponse] = await Promise.all([
      api.get<{
        status: SessionStatus;
        participantCount: number;
        joinCode: string;
      }>(`/api/sessions/${id}/lobby`),
      api.get<SessionStatus>(`/api/sessions/${id}/status`),
    ]);

    if (lobbyResponse.success) {
      setParticipantCount(lobbyResponse.data.participantCount);
      if (lobbyResponse.data.joinCode) {
        setJoinCode(lobbyResponse.data.joinCode);
      }
      setSessionStatus(lobbyResponse.data.status);
    }

    if (statusResponse.success) {
      setSessionStatus(statusResponse.data);
      if (statusResponse.data === "ENDED") {
        void loadResults();
      }
    }

    setHydrated(true);
  }, [id, loadResults]);

  const { subscribe, unsubscribe } = useStompClient({
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    onConnect: () => {
      void loadSessionContext();
    },
  });

  useEffect(() => {
    if (copied) {
      const timeout = window.setTimeout(() => setCopied(false), 1500);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [copied]);

  useEffect(() => {
    const questionDestination = `/topic/session.${id}.question`;
    const analyticsDestination = `/topic/session.${id}.analytics`;
    const controlDestination = `/topic/session.${id}.control`;

    subscribe(questionDestination, (msg) => {
      const data = msg as
        | QuestionDisplayedMsg
        | PassageDisplayedMsg
        | TimerStartMsg
        | QuestionFrozenMsg
        | PassageFrozenMsg
        | QuestionReviewedMsg
        | ScoringCorrectedMsg
        | SessionEndMsg
        | ParticipantLeaderboardMsg;

      if (data.event === "QUESTION_DISPLAYED") {
        const question: ActiveQuestion = {
          id: data.questionId,
          text: data.text,
          questionType: data.questionType,
          orderIndex: data.questionIndex,
          totalQuestions: data.totalQuestions,
          timeLimitSeconds: data.timeLimitSeconds,
          effectiveDisplayMode: data.effectiveDisplayMode,
          passage: data.passage,
          options: data.options,
        };
        setSessionStatus("ACTIVE");
        setQuestionLifecycle("DISPLAYED");
        setActiveQuestion(question);
        setActivePassage(
          data.passage
            ? {
                id: data.passage.id,
                text: data.passage.text,
                timerMode: "PER_SUB_QUESTION",
                questionIndex: data.questionIndex,
                totalQuestions: data.totalQuestions,
                effectiveDisplayMode: data.effectiveDisplayMode,
                subQuestions: [question],
              }
            : null,
        );
        setQuestionIndex(data.questionIndex);
        setTotalQuestions(data.totalQuestions);
        setEffectiveDisplayMode(data.effectiveDisplayMode);
        setTimeLeft(0);
        setTimerLimitSeconds(0);
        setQuestionStatsById((prev) =>
          updateStats(prev, data.questionId, DEFAULT_STATS()),
        );
        return;
      }

      if (data.event === "PASSAGE_DISPLAYED") {
        const subQuestions: ActiveQuestion[] = data.subQuestions.map(
          (question, index) => ({
            id: question.questionId,
            text: question.text,
            questionType: question.questionType,
            orderIndex: data.questionIndex + index,
            totalQuestions: data.totalQuestions,
            timeLimitSeconds: 0,
            effectiveDisplayMode: data.effectiveDisplayMode,
            passage: { id: data.passageId, text: data.passageText },
            options: question.options,
          }),
        );

        setSessionStatus("ACTIVE");
        setQuestionLifecycle("DISPLAYED");
        setActiveQuestion(null);
        setActivePassage({
          id: data.passageId,
          text: data.passageText,
          timerMode: "ENTIRE_PASSAGE",
          questionIndex: data.questionIndex,
          totalQuestions: data.totalQuestions,
          effectiveDisplayMode: data.effectiveDisplayMode,
          subQuestions,
        });
        setQuestionIndex(data.questionIndex);
        setTotalQuestions(data.totalQuestions);
        setEffectiveDisplayMode(data.effectiveDisplayMode);
        setTimeLeft(0);
        setTimerLimitSeconds(0);
        setQuestionStatsById((prev) => {
          const next = { ...prev };
          subQuestions.forEach((question) => {
            next[question.id] = next[question.id] ?? DEFAULT_STATS();
          });
          return next;
        });
        return;
      }

      if (data.event === "TIMER_START") {
        setSessionStatus("ACTIVE");
        setQuestionLifecycle("TIMED");
        setTimerLimitSeconds(data.timeLimitSeconds);
        setTimeLeft(data.timeLimitSeconds);
        return;
      }

      if (data.event === "QUESTION_FROZEN" || data.event === "PASSAGE_FROZEN") {
        setQuestionLifecycle("FROZEN");
        setTimeLeft(0);
        return;
      }

      if (data.event === "QUESTION_REVIEWED") {
        setQuestionLifecycle("REVIEWING");
        setQuestionStatsById((prev) =>
          updateStats(prev, data.questionId, {
            correctOptionIds: data.correctOptionIds,
            optionPoints: normalizePoints(data.optionPoints),
            reviewed: true,
          }),
        );
        return;
      }

      if (data.event === "SCORING_CORRECTED") {
        setQuestionLifecycle("REVIEWING");
        setQuestionStatsById((prev) =>
          updateStats(prev, data.questionId, {
            correctOptionIds: data.correctOptionIds,
            optionPoints: normalizePoints(data.optionPoints),
            reviewed: true,
          }),
        );
        return;
      }

      if (data.event === "PARTICIPANT_LEADERBOARD") {
        // Participant leaderboard is useful for participants; host view uses the full leaderboard.
        return;
      }

      if (data.event === "SESSION_END") {
        setSessionStatus("ENDED");
        void loadResults();
      }
    });

    subscribe(analyticsDestination, (msg) => {
      const data = msg as
        | AnswerUpdateMsg
        | AnswerRevealMsg
        | LeaderboardUpdateMsg
        | SessionEndMsg;
      if (data.event === "ANSWER_UPDATE") {
        setQuestionStatsById((prev) =>
          updateStats(prev, data.questionId, {
            counts: normalizeCounts(data.counts),
            totalAnswered: data.totalAnswered,
            totalLockedIn: data.totalLockedIn,
            totalParticipants: data.totalParticipants,
          }),
        );
        return;
      }

      if (data.event === "ANSWER_REVEAL") {
        setQuestionStatsById((prev) =>
          updateStats(prev, data.questionId, {
            counts: normalizeCounts(data.counts),
            totalAnswered: data.totalAnswered,
            totalParticipants: data.totalParticipants,
            revealed: true,
          }),
        );
        return;
      }

      if (data.event === "LEADERBOARD_UPDATE") {
        setLeaderboard(data.leaderboard);
        return;
      }

      if (data.event === "SESSION_END") {
        if (data.leaderboard) {
          setFinalLeaderboard(data.leaderboard);
        }
        setSessionStatus("ENDED");
      }
    });

    subscribe(controlDestination, (msg) => {
      const data = msg as { event: "PARTICIPANT_JOINED"; count: number };
      if (data.event === "PARTICIPANT_JOINED") {
        setParticipantCount(data.count);
      }
    });

    return () => {
      unsubscribe(questionDestination);
      unsubscribe(analyticsDestination);
      unsubscribe(controlDestination);
    };
  }, [id, loadResults, subscribe, unsubscribe]);

  useEffect(() => {
    if (
      sessionStatus !== "ACTIVE" ||
      questionLifecycle !== "TIMED" ||
      timeLeft <= 0
    ) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [questionLifecycle, sessionStatus, timeLeft]);

  const currentQuestions = useMemo(() => {
    if (activePassage?.subQuestions.length) {
      return activePassage.subQuestions;
    }
    return activeQuestion ? [activeQuestion] : [];
  }, [activePassage, activeQuestion]);

  const primaryQuestion = currentQuestions[0] ?? null;

  const reviewQuestions: QuestionCardData[] =
    sessionStatus === "ENDED"
      ? (sessionResults?.questions
          ?.toSorted((a, b) => a.orderIndex - b.orderIndex)
          .map(buildResultsQuestionCard) ?? [])
      : currentQuestions.map((question) =>
          buildActiveQuestionCard(
            question,
            questionStatsById[question.id],
            activePassage?.timerMode === "PER_SUB_QUESTION"
              ? activePassage.text
              : null,
          ),
        );

  const currentQuestionStats = primaryQuestion
    ? (questionStatsById[primaryQuestion.id] ?? DEFAULT_STATS())
    : DEFAULT_STATS();

  const canAdvance =
    questionLifecycle === "REVIEWING" &&
    reviewQuestions.length > 0 &&
    reviewQuestions.every((question) => {
      const stats = questionStatsById[question.id];
      return stats?.reviewed ?? sessionStatus === "ENDED";
    });

  const timerColour =
    timeLeft <= 5
      ? "var(--color-danger)"
      : timeLeft <= 10
        ? "var(--color-warning)"
        : "var(--color-foreground)";

  const timerPct =
    timerLimitSeconds > 0 ? (timeLeft / timerLimitSeconds) * 100 : 0;

  const openScoringDrawer = useCallback((question: QuestionCardData) => {
    setScoringQuestionId(question.id);
    setScoringQuestionTitle(question.text);
    setScoringDraft(
      question.options.map((option) => ({
        optionId: option.id,
        text: option.text,
        orderIndex: option.orderIndex,
        pointValue: String(option.pointValue),
      })),
    );
  }, []);

  const closeDrawer = useCallback(() => {
    setScoringQuestionId(null);
    setScoringQuestionTitle("");
    setScoringDraft([]);
  }, []);

  const handleStartSession = useCallback(async () => {
    if (!id) return;
    setLoadingAction("start-session");
    const response = await sessionsApi.start(id);
    if (response.success) {
      setSessionStatus("ACTIVE");
    }
    setLoadingAction(null);
  }, [id]);

  const handleStartTimer = useCallback(async () => {
    if (!id) return;
    setLoadingAction("start-timer");
    await sessionsApi.startTimer(id);
    setLoadingAction(null);
  }, [id]);

  const handleEndTimerEarly = useCallback(async () => {
    if (!id) return;
    setLoadingAction("end-timer");
    await sessionsApi.endTimer(id);
    setLoadingAction(null);
  }, [id]);

  const handleNextQuestion = useCallback(async () => {
    if (!id) return;
    setLoadingAction("next");
    await sessionsApi.next(id);
    setLoadingAction(null);
  }, [id]);

  const handleForceEnd = useCallback(async () => {
    if (!id) return;
    setLoadingAction("end-session");
    await sessionsApi.end(id);
    setLoadingAction(null);
    setSessionStatus("ENDED");
  }, [id]);

  const handleCopyCode = useCallback(() => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode).then(() => {
      setCopied(true);
    });
  }, [joinCode]);

  const handleSaveScoring = useCallback(async () => {
    if (!id || scoringQuestionId == null) return;
    setDrawerSaving(true);

    const payload = scoringDraft.map((option) => ({
      optionId: option.optionId,
      pointValue: Number(option.pointValue) || 0,
    }));
    const response = await sessionsApi.correctScoring(
      id,
      scoringQuestionId,
      payload,
    );

    if (response.success) {
      const nextPoints = Object.fromEntries(
        payload.map((option) => [option.optionId, option.pointValue]),
      ) as Record<number, number>;
      const nextCorrectIds = payload
        .filter((option) => option.pointValue > 0)
        .map((option) => option.optionId);

      setQuestionStatsById((prev) =>
        updateStats(prev, scoringQuestionId, {
          optionPoints: nextPoints,
          correctOptionIds: nextCorrectIds,
          reviewed: true,
        }),
      );

      if (sessionStatus === "ENDED") {
        await loadResults();
      }
      setScoringQuestionId(null);
      setScoringQuestionTitle("");
      setScoringDraft([]);
    }

    setDrawerSaving(false);
  }, [id, loadResults, scoringDraft, scoringQuestionId, sessionStatus]);

  const activeModeLabel = displayModeLabel(effectiveDisplayMode);
  const progressLabel =
    questionIndex > 0 && totalQuestions > 0
      ? `Q${questionIndex} / ${totalQuestions}`
      : "Awaiting question";

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
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Logo size="sm" />
            <div className="flex items-center gap-3">
              <CardBadge tone="warning">Lobby</CardBadge>
              <span className="text-xs text-muted tabular-nums">
                {participantCount} participants
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-7xl items-center justify-center px-6 py-10">
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
                {participantCount} joined
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
    const leaderboardRows = (finalLeaderboard ?? leaderboard).slice(0, 10);
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Logo size="sm" />
            <div className="flex items-center gap-3">
              <CardBadge tone="muted">Ended</CardBadge>
              <span className="text-xs text-muted tabular-nums">
                {participantCount} participants
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo size="sm" />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <CardBadge
              tone={sessionStatus === "ACTIVE" ? "success" : "warning"}
            >
              {sessionStatus}
            </CardBadge>
            <CardBadge tone="accent">{questionLifecycle}</CardBadge>
            <span className="text-xs text-muted tabular-nums">
              {participantCount} participants
            </span>
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

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
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
                    textShadow:
                      timeLeft <= 5
                        ? `0 0 16px rgba(${colorRgb.danger},0.45)`
                        : "none",
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
              className="border border-border bg-surface p-8"
            >
              <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
                <div>
                  <p className="label mb-4">Join code</p>
                  <div
                    className="select-all border border-primary/30 bg-background px-8 py-6 font-black tracking-[0.35em] text-foreground"
                    style={{
                      fontSize: "clamp(2.5rem, 8vw, 5.5rem)",
                      letterSpacing: "0.35em",
                      paddingLeft: "calc(2rem + 0.35em)",
                    }}
                  >
                    {joinCode || "------"}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border border-border bg-background p-4">
                    <p className="label mb-2">Prompt</p>
                    <h2 className="text-2xl font-bold leading-snug text-foreground">
                      {activePassage?.timerMode === "ENTIRE_PASSAGE"
                        ? activePassage.text
                        : primaryQuestion?.text || "Waiting for question..."}
                    </h2>
                    {passageBannerText ? (
                      <p className="mt-3 text-sm text-muted">
                        {passageBannerText}
                      </p>
                    ) : null}
                  </div>

                  <div className="border border-border bg-background p-4">
                    <p className="label mb-2">Status</p>
                    <div className="space-y-2 text-sm text-muted">
                      <p>{questionLifecycle}</p>
                      <p className="tabular-nums">
                        {formatTime(timeLeft)} remaining
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {currentQuestions.length > 0 ? (
                <div className="mt-6 space-y-4">
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
                activeLeaderboard
                  .slice(0, 10)
                  .map((entry, index) => (
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
        onChange={(index, value) =>
          setScoringDraft((current) =>
            current.map((option, optionIndex) =>
              optionIndex === index ? { ...option, pointValue: value } : option,
            ),
          )
        }
        onSave={handleSaveScoring}
      />
    </div>
  );
}
