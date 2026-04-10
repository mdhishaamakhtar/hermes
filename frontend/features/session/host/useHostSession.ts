"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { api } from "@/lib/api";
import { sessionsApi } from "@/lib/apiClient";
import { getStoredAuthToken } from "@/lib/auth-storage";
import { useStompClient } from "@/hooks/useStompClient";
import { normalizeCounts, normalizePoints } from "@/lib/session-utils";
import { getStoredSessionJoinCode } from "@/lib/session-storage";
import type { CorrectionDraftOption } from "@/components/session/ScoringDrawer";
import type { QuestionCardData } from "@/components/session/QuestionCard";
import type {
  DisplayMode,
  PassageTimerMode,
  SessionResults,
} from "@/lib/types";

export type SessionStatus = "LOBBY" | "ACTIVE" | "ENDED";
export type QuestionLifecycle = "DISPLAYED" | "TIMED" | "FROZEN" | "REVIEWING";

export interface ActiveOption {
  id: number;
  text: string;
  orderIndex: number;
}

export interface ActiveQuestion {
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

export interface ActivePassage {
  id: number;
  text: string;
  timerMode: PassageTimerMode;
  questionIndex: number;
  totalQuestions: number;
  effectiveDisplayMode: DisplayMode;
  subQuestions: ActiveQuestion[];
}

export interface QuestionStats {
  counts: Record<number, number>;
  totalAnswered: number;
  totalLockedIn: number;
  totalParticipants: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
  revealed: boolean;
  reviewed: boolean;
}

export interface LiveLeaderboardEntry {
  rank: number;
  participantId: number;
  displayName: string;
  score: number;
}

export interface QuestionDisplayedMsg {
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

export interface PassageDisplayedMsg {
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

export interface TimerStartMsg {
  event: "TIMER_START";
  questionId: number | null;
  passageId: number | null;
  timeLimitSeconds: number;
}

export interface QuestionFrozenMsg {
  event: "QUESTION_FROZEN";
  questionId: number;
}

export interface PassageFrozenMsg {
  event: "PASSAGE_FROZEN";
  passageId: number;
  subQuestionIds: number[];
}

export interface QuestionReviewedMsg {
  event: "QUESTION_REVIEWED";
  questionId: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
}

export interface ScoringCorrectedMsg {
  event: "SCORING_CORRECTED";
  questionId: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
}

export interface AnswerUpdateMsg {
  event: "ANSWER_UPDATE";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
  totalLockedIn: number;
}

export interface AnswerRevealMsg {
  event: "ANSWER_REVEAL";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
}

export interface LeaderboardUpdateMsg {
  event: "LEADERBOARD_UPDATE";
  leaderboard: LiveLeaderboardEntry[];
}

export interface ParticipantLeaderboardMsg {
  event: "PARTICIPANT_LEADERBOARD";
  top: Array<{ rank: number; displayName: string; score: number }>;
  totalParticipants: number;
}

export interface SessionEndMsg {
  event: "SESSION_END";
  leaderboard?: LiveLeaderboardEntry[];
  totalParticipants?: number;
}

export interface HostSessionState {
  sessionStatus: SessionStatus;
  questionLifecycle: QuestionLifecycle;
  joinCode: string;
  participantCount: number;
  activeQuestion: ActiveQuestion | null;
  activePassage: ActivePassage | null;
  questionIndex: number;
  totalQuestions: number;
  effectiveDisplayMode: DisplayMode;
  timerLimitSeconds: number;
  timeLeft: number;
  questionStatsById: Record<number, QuestionStats>;
  leaderboard: LiveLeaderboardEntry[];
  finalLeaderboard:
    | { rank: number; displayName: string; score: number }[]
    | null;
  sessionResults: SessionResults | null;
  hydrated: boolean;
}

export type HostSessionAction =
  | {
      type: "CONTEXT_LOADED";
      lobby?: {
        status: SessionStatus;
        participantCount: number;
        joinCode: string;
      };
      status?: SessionStatus;
    }
  | { type: "RESULTS_LOADED"; results: SessionResults }
  | { type: "QUESTION_DISPLAYED"; message: QuestionDisplayedMsg }
  | { type: "PASSAGE_DISPLAYED"; message: PassageDisplayedMsg }
  | { type: "TIMER_START"; timeLimitSeconds: number }
  | { type: "QUESTION_FROZEN" }
  | {
      type: "QUESTION_REVIEWED";
      questionId: number;
      correctOptionIds: number[];
      optionPoints: Record<number, number>;
    }
  | { type: "ANSWER_UPDATE"; message: AnswerUpdateMsg }
  | { type: "ANSWER_REVEAL"; message: AnswerRevealMsg }
  | { type: "LEADERBOARD_UPDATE"; leaderboard: LiveLeaderboardEntry[] }
  | { type: "SESSION_END"; leaderboard?: LiveLeaderboardEntry[] }
  | { type: "PARTICIPANT_JOINED"; count: number }
  | { type: "SESSION_STARTED" }
  | { type: "TIMER_TICK" }
  | {
      type: "SCORING_CORRECTED_LOCAL";
      questionId: number;
      optionPoints: Record<number, number>;
      correctOptionIds: number[];
    };

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

export function displayModeLabel(mode: DisplayMode) {
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

export function initHostSessionState(id: string): HostSessionState {
  return {
    sessionStatus: "LOBBY",
    questionLifecycle: "DISPLAYED",
    joinCode: getStoredSessionJoinCode(id),
    participantCount: 0,
    activeQuestion: null,
    activePassage: null,
    questionIndex: 0,
    totalQuestions: 0,
    effectiveDisplayMode: "LIVE",
    timerLimitSeconds: 0,
    timeLeft: 0,
    questionStatsById: {},
    leaderboard: [],
    finalLeaderboard: null,
    sessionResults: null,
    hydrated: false,
  };
}

export function hostSessionReducer(
  state: HostSessionState,
  action: HostSessionAction,
): HostSessionState {
  switch (action.type) {
    case "CONTEXT_LOADED": {
      const nextStatus =
        action.status ?? action.lobby?.status ?? state.sessionStatus;
      return {
        ...state,
        participantCount:
          action.lobby?.participantCount ?? state.participantCount,
        joinCode: action.lobby?.joinCode || state.joinCode,
        sessionStatus: nextStatus,
        hydrated: true,
      };
    }
    case "RESULTS_LOADED":
      return {
        ...state,
        sessionResults: action.results,
        finalLeaderboard: action.results.leaderboard,
      };
    case "QUESTION_DISPLAYED": {
      const data = action.message;
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
      return {
        ...state,
        sessionStatus: "ACTIVE",
        questionLifecycle: "DISPLAYED",
        activeQuestion: question,
        activePassage: data.passage
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
        questionIndex: data.questionIndex,
        totalQuestions: data.totalQuestions,
        effectiveDisplayMode: data.effectiveDisplayMode,
        timeLeft: 0,
        timerLimitSeconds: 0,
        questionStatsById: updateStats(
          state.questionStatsById,
          data.questionId,
          DEFAULT_STATS(),
        ),
      };
    }
    case "PASSAGE_DISPLAYED": {
      const data = action.message;
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
      const nextStats = { ...state.questionStatsById };
      subQuestions.forEach((question) => {
        nextStats[question.id] = nextStats[question.id] ?? DEFAULT_STATS();
      });
      return {
        ...state,
        sessionStatus: "ACTIVE",
        questionLifecycle: "DISPLAYED",
        activeQuestion: null,
        activePassage: {
          id: data.passageId,
          text: data.passageText,
          timerMode: "ENTIRE_PASSAGE",
          questionIndex: data.questionIndex,
          totalQuestions: data.totalQuestions,
          effectiveDisplayMode: data.effectiveDisplayMode,
          subQuestions,
        },
        questionIndex: data.questionIndex,
        totalQuestions: data.totalQuestions,
        effectiveDisplayMode: data.effectiveDisplayMode,
        timeLeft: 0,
        timerLimitSeconds: 0,
        questionStatsById: nextStats,
      };
    }
    case "TIMER_START":
      return {
        ...state,
        sessionStatus: "ACTIVE",
        questionLifecycle: "TIMED",
        timerLimitSeconds: action.timeLimitSeconds,
        timeLeft: action.timeLimitSeconds,
      };
    case "QUESTION_FROZEN":
      return { ...state, questionLifecycle: "FROZEN", timeLeft: 0 };
    case "QUESTION_REVIEWED":
      return {
        ...state,
        questionLifecycle: "REVIEWING",
        questionStatsById: updateStats(
          state.questionStatsById,
          action.questionId,
          {
            correctOptionIds: action.correctOptionIds,
            optionPoints: normalizePoints(action.optionPoints),
            reviewed: true,
          },
        ),
      };
    case "ANSWER_UPDATE":
      return {
        ...state,
        questionStatsById: updateStats(
          state.questionStatsById,
          action.message.questionId,
          {
            counts: normalizeCounts(action.message.counts),
            totalAnswered: action.message.totalAnswered,
            totalLockedIn: action.message.totalLockedIn,
            totalParticipants: action.message.totalParticipants,
          },
        ),
      };
    case "ANSWER_REVEAL":
      return {
        ...state,
        questionStatsById: updateStats(
          state.questionStatsById,
          action.message.questionId,
          {
            counts: normalizeCounts(action.message.counts),
            totalAnswered: action.message.totalAnswered,
            totalParticipants: action.message.totalParticipants,
            revealed: true,
          },
        ),
      };
    case "LEADERBOARD_UPDATE":
      return { ...state, leaderboard: action.leaderboard };
    case "SESSION_END":
      return {
        ...state,
        sessionStatus: "ENDED",
        finalLeaderboard: action.leaderboard ?? state.finalLeaderboard,
      };
    case "PARTICIPANT_JOINED":
      return { ...state, participantCount: action.count };
    case "SESSION_STARTED":
      return { ...state, sessionStatus: "ACTIVE" };
    case "TIMER_TICK":
      if (state.timeLeft <= 0) return state;
      return { ...state, timeLeft: Math.max(0, state.timeLeft - 1) };
    case "SCORING_CORRECTED_LOCAL":
      return {
        ...state,
        questionStatsById: updateStats(
          state.questionStatsById,
          action.questionId,
          {
            optionPoints: action.optionPoints,
            correctOptionIds: action.correctOptionIds,
            reviewed: true,
          },
        ),
      };
  }
}

export function buildActiveQuestionCard(
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
    passageId: question.passageId,
    passageText: question.passageText,
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

export function useHostSession(id: string) {
  const [session, dispatch] = useReducer(
    hostSessionReducer,
    id,
    initHostSessionState,
  );
  const {
    sessionStatus,
    questionLifecycle,
    joinCode,
    participantCount,
    activeQuestion,
    activePassage,
    questionIndex,
    totalQuestions,
    effectiveDisplayMode,
    timerLimitSeconds,
    timeLeft,
    questionStatsById,
    leaderboard,
    finalLeaderboard,
    sessionResults,
    hydrated,
  } = session;
  const [copied, setCopied] = useState(false);
  const [loadingAction, setLoadingAction] = useState<
    | null
    | "start-session"
    | "start-timer"
    | "end-timer"
    | "next"
    | "end-session"
  >(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [scoringQuestionId, setScoringQuestionId] = useState<number | null>(
    null,
  );
  const [scoringQuestionTitle, setScoringQuestionTitle] = useState("");
  const [scoringDraft, setScoringDraft] = useState<CorrectionDraftOption[]>([]);
  const [scoringError, setScoringError] = useState("");

  const authToken = getStoredAuthToken();

  const loadResults = useCallback(async () => {
    if (!id) return;
    const response = await api.get<SessionResults>(
      `/api/sessions/${id}/results`,
    );
    if (response.success) {
      dispatch({ type: "RESULTS_LOADED", results: response.data });
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
      dispatch({ type: "CONTEXT_LOADED", lobby: lobbyResponse.data });
    }

    if (statusResponse.success) {
      dispatch({ type: "CONTEXT_LOADED", status: statusResponse.data });
      if (statusResponse.data === "ENDED") {
        void loadResults();
      }
    }

    dispatch({ type: "CONTEXT_LOADED" });
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
        dispatch({ type: "QUESTION_DISPLAYED", message: data });
        return;
      }

      if (data.event === "PASSAGE_DISPLAYED") {
        dispatch({ type: "PASSAGE_DISPLAYED", message: data });
        return;
      }

      if (data.event === "TIMER_START") {
        dispatch({
          type: "TIMER_START",
          timeLimitSeconds: data.timeLimitSeconds,
        });
        return;
      }

      if (data.event === "QUESTION_FROZEN" || data.event === "PASSAGE_FROZEN") {
        dispatch({ type: "QUESTION_FROZEN" });
        return;
      }

      if (data.event === "QUESTION_REVIEWED") {
        dispatch({
          type: "QUESTION_REVIEWED",
          questionId: data.questionId,
          correctOptionIds: data.correctOptionIds,
          optionPoints: data.optionPoints,
        });
        return;
      }

      if (data.event === "SCORING_CORRECTED") {
        dispatch({
          type: "QUESTION_REVIEWED",
          questionId: data.questionId,
          correctOptionIds: data.correctOptionIds,
          optionPoints: data.optionPoints,
        });
        return;
      }

      if (data.event === "PARTICIPANT_LEADERBOARD") {
        // Participant leaderboard is useful for participants; host view uses the full leaderboard.
        return;
      }

      if (data.event === "SESSION_END") {
        dispatch({ type: "SESSION_END" });
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
        dispatch({ type: "ANSWER_UPDATE", message: data });
        return;
      }

      if (data.event === "ANSWER_REVEAL") {
        dispatch({ type: "ANSWER_REVEAL", message: data });
        return;
      }

      if (data.event === "LEADERBOARD_UPDATE") {
        dispatch({ type: "LEADERBOARD_UPDATE", leaderboard: data.leaderboard });
        return;
      }

      if (data.event === "SESSION_END") {
        dispatch({ type: "SESSION_END", leaderboard: data.leaderboard });
      }
    });

    subscribe(controlDestination, (msg) => {
      const data = msg as { event: "PARTICIPANT_JOINED"; count: number };
      if (data.event === "PARTICIPANT_JOINED") {
        dispatch({ type: "PARTICIPANT_JOINED", count: data.count });
      }
    });

    return () => {
      unsubscribe(questionDestination);
      unsubscribe(analyticsDestination);
      unsubscribe(controlDestination);
    };
  }, [id, loadResults, subscribe, unsubscribe]);

  useEffect(() => {
    if (sessionStatus !== "ACTIVE" || questionLifecycle !== "TIMED") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      dispatch({ type: "TIMER_TICK" });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [questionLifecycle, sessionStatus]);

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
    setScoringError("");
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
    setScoringError("");
    setScoringQuestionId(null);
    setScoringQuestionTitle("");
    setScoringDraft([]);
  }, []);

  const handleStartSession = useCallback(async () => {
    if (!id) return;
    setLoadingAction("start-session");
    const response = await sessionsApi.start(id);
    if (response.success) {
      dispatch({ type: "SESSION_STARTED" });
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
    const res = await sessionsApi.end(id);
    if (res.success) {
      await loadResults();
      dispatch({ type: "SESSION_END" });
    }
    setLoadingAction(null);
  }, [id, loadResults]);

  const handleCopyCode = useCallback(() => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode).then(() => {
      setCopied(true);
    });
  }, [joinCode]);

  const handleSaveScoring = useCallback(async () => {
    if (!id || scoringQuestionId == null) return;
    setDrawerSaving(true);
    setScoringError("");

    try {
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

        dispatch({
          type: "SCORING_CORRECTED_LOCAL",
          questionId: scoringQuestionId,
          optionPoints: nextPoints,
          correctOptionIds: nextCorrectIds,
        });

        if (sessionStatus === "ENDED") {
          await loadResults();
        }
        setScoringQuestionId(null);
        setScoringQuestionTitle("");
        setScoringDraft([]);
        return;
      }

      setScoringError(response.error?.message ?? "Failed to update scoring.");
    } finally {
      setDrawerSaving(false);
    }
  }, [id, loadResults, scoringDraft, scoringQuestionId, sessionStatus]);

  const activeModeLabel = displayModeLabel(effectiveDisplayMode);
  const progressLabel =
    questionIndex > 0 && totalQuestions > 0
      ? `Q${questionIndex} / ${totalQuestions}`
      : "Awaiting question";

  return {
    session,
    sessionStatus,
    questionLifecycle,
    joinCode,
    participantCount,
    activeQuestion,
    activePassage,
    questionIndex,
    totalQuestions,
    effectiveDisplayMode,
    timerLimitSeconds,
    timeLeft,
    questionStatsById,
    leaderboard,
    finalLeaderboard,
    sessionResults,
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
  };
}
