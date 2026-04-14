"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getStoredAuthToken } from "@/lib/auth-storage";
import { useStompClient } from "@/hooks/useStompClient";
import { WS_ACK_TIMEOUT_MS } from "@/lib/session-constants";
import {
  normalizeCounts,
  normalizeIdList,
  normalizePoints,
} from "@/lib/session-utils";
import {
  getStoredRejoinToken,
  removeStoredRejoinToken,
} from "@/lib/session-storage";
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

export type SessionState = "LOBBY" | "ACTIVE" | "ENDED";
export type { QuestionLifecycle } from "@/features/session/shared/session-types";
import type {
  QuestionLifecycle,
  TimerStartMsg,
  QuestionFrozenMsg,
  PassageFrozenMsg,
  QuestionReviewedMsg,
  ScoringCorrectedMsg,
} from "@/features/session/shared/session-types";

// Local aliases kept for the QuestionEventMsg union below
type SessionTimerStartMsg = TimerStartMsg;
type SessionQuestionFrozenMsg = QuestionFrozenMsg;
type SessionPassageFrozenMsg = PassageFrozenMsg;
type SessionQuestionReviewedMsg = QuestionReviewedMsg;
type SessionScoringCorrectedMsg = ScoringCorrectedMsg;

export interface ParticipantOption {
  id: number;
  text: string;
  orderIndex: number;
}

export interface ParticipantQuestion {
  id: number;
  text: string;
  questionIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number;
  questionType: QuestionType;
  effectiveDisplayMode: DisplayMode;
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

export interface SubQuestion {
  questionId: number;
  text: string;
  questionType: QuestionType;
  options: ParticipantOption[];
}

export interface ParticipantPassage {
  id: number;
  text: string;
  timerMode: PassageTimerMode;
  questionIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number | null;
  effectiveDisplayMode: DisplayMode;
}

export interface SessionQuestionDisplayedMsg {
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

export interface SessionPassageDisplayedMsg {
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

export interface SessionAnswerUpdateMsg {
  event: "ANSWER_UPDATE";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
  totalLockedIn: number;
}

export interface SessionAnswerRevealMsg {
  event: "ANSWER_REVEAL";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
}

export interface SessionParticipantLeaderboardMsg {
  event: "PARTICIPANT_LEADERBOARD";
  leaderboard: ParticipantLeaderboardEntry[];
  totalParticipants: number;
}

export interface ParticipantJoinedMsg {
  event: "PARTICIPANT_JOINED";
  count: number;
}

export interface SessionLeaderboardUpdateMsg {
  event: "LEADERBOARD_UPDATE";
  leaderboard: LeaderboardEntry[];
}

export interface SessionAnswerAcceptedMsg {
  event: "ANSWER_ACCEPTED";
  clientRequestId: string;
  questionId: number;
  lockedIn: boolean;
}

export interface SessionAnswerRejectedMsg {
  event: "ANSWER_REJECTED";
  clientRequestId: string;
  questionId: number;
  code: string;
  message: string;
  lockedIn: boolean;
}

export interface SessionEndMsg {
  event: "SESSION_END";
  leaderboard?: LeaderboardEntry[];
  totalParticipants?: number;
}

export type QuestionEventMsg =
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

export type AnalyticsEventMsg =
  | SessionAnswerUpdateMsg
  | SessionAnswerRevealMsg
  | SessionLeaderboardUpdateMsg
  | SessionEndMsg;

export type AnswerAckMsg = SessionAnswerAcceptedMsg | SessionAnswerRejectedMsg;

export interface PlaySessionState {
  sessionState: SessionState;
  questionLifecycle: QuestionLifecycle;
  sessionTitle: string;
  participantCount: number;
  participantId: number | null;
  questions: ParticipantQuestion[];
  passage: ParticipantPassage | null;
  timeLeft: number | null;
  /** Set from TIMER_START; used for the progress bar when passage/questions still have 0/null limits. */
  liveTimerLimitSeconds: number | null;
  leaderboard: LeaderboardEntry[];
  participantLeaderboard: ParticipantLeaderboardEntry[];
  finalLeaderboard: LeaderboardEntry[];
  hydrated: boolean;
  syncStatus: "idle" | "saving" | "retrying" | "error";
  syncMessage: string;
}

export type PlaySessionAction =
  | { type: "REJOIN_LOADED"; response: RejoinResponse }
  | { type: "HYDRATED" }
  | { type: "QUESTION_DISPLAYED"; message: SessionQuestionDisplayedMsg }
  | { type: "PASSAGE_DISPLAYED"; message: SessionPassageDisplayedMsg }
  | { type: "SESSION_END"; leaderboard?: LeaderboardEntry[] }
  | { type: "TIMER_START"; timeLimitSeconds: number }
  | {
      type: "QUESTION_FROZEN";
      message: SessionQuestionFrozenMsg | SessionPassageFrozenMsg;
    }
  | {
      type: "QUESTION_REVIEWED";
      questionId: number;
      correctOptionIds: number[];
      optionPoints: Record<number, number>;
    }
  | {
      type: "PARTICIPANT_LEADERBOARD";
      leaderboard: ParticipantLeaderboardEntry[];
      totalParticipants: number;
    }
  | { type: "PARTICIPANT_JOINED"; count: number }
  | { type: "ANSWER_UPDATE"; message: SessionAnswerUpdateMsg }
  | { type: "ANSWER_REVEAL"; message: SessionAnswerRevealMsg }
  | { type: "TIMER_TICK" }
  | {
      type: "SYNC_STATUS";
      status: PlaySessionState["syncStatus"];
      message: string;
    }
  | { type: "SET_SELECTION"; questionId: number; selectedOptionIds: number[] }
  | { type: "LOCKED_IN"; questionId: number }
  | { type: "LOCK_IN_ROLLBACK"; questionId: number };

function normalizeSelectionIds(selectedOptionIds: number[]) {
  return selectedOptionIds.toSorted((a, b) => a - b);
}

function createClientRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function formatQuestionSpanLabel(
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

export function sumQuestionPoints(question: ParticipantQuestion) {
  return Math.max(
    0,
    question.selectedOptionIds.reduce(
      (total, optionId) => total + (question.optionPoints[optionId] ?? 0),
      0,
    ),
  );
}

/** Total points for every question currently visible (e.g. full passage block). */
export function sumVisibleQuestionsPoints(questions: ParticipantQuestion[]) {
  return questions.reduce((sum, q) => sum + sumQuestionPoints(q), 0);
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
    passageId,
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

export function initPlaySessionState(
  rejoinToken: string | null,
): PlaySessionState {
  return {
    sessionState: "LOBBY",
    questionLifecycle: "DISPLAYED",
    sessionTitle: "Live Session",
    participantCount: 0,
    participantId: null,
    questions: [],
    passage: null,
    timeLeft: null,
    liveTimerLimitSeconds: null,
    leaderboard: [],
    participantLeaderboard: [],
    finalLeaderboard: [],
    hydrated: rejoinToken === null,
    syncStatus: "idle",
    syncMessage: "",
  };
}

export function playSessionReducer(
  state: PlaySessionState,
  action: PlaySessionAction,
): PlaySessionState {
  switch (action.type) {
    case "REJOIN_LOADED": {
      const data = action.response;
      let passage: ParticipantPassage | null = null;
      let questions = state.questions;

      if (data.currentPassage) {
        const currentPassage = data.currentPassage;
        passage = {
          id: currentPassage.id,
          text: currentPassage.text,
          timerMode: currentPassage.timerMode,
          questionIndex: currentPassage.questionIndex,
          totalQuestions: currentPassage.totalQuestions,
          timeLimitSeconds: currentPassage.timeLimitSeconds,
          effectiveDisplayMode: currentPassage.effectiveDisplayMode,
        };
        questions = currentPassage.subQuestions.map((subQuestion) =>
          buildQuestionFromRejoin(
            subQuestion,
            currentPassage.totalQuestions,
            currentPassage.effectiveDisplayMode,
            currentPassage.id,
            currentPassage.timeLimitSeconds ?? subQuestion.timeLimitSeconds,
          ),
        );
      } else if (data.currentQuestion) {
        passage = data.currentQuestion.passage
          ? {
              id: data.currentQuestion.passage.id,
              text: data.currentQuestion.passage.text,
              timerMode: data.currentQuestion.passage.timerMode,
              questionIndex: data.currentQuestion.orderIndex,
              totalQuestions: data.currentQuestion.totalQuestions,
              timeLimitSeconds: data.currentQuestion.timeLimitSeconds,
              effectiveDisplayMode: data.currentQuestion.effectiveDisplayMode,
            }
          : null;
        questions = [
          buildQuestionFromRejoin(
            data.currentQuestion,
            data.currentQuestion.totalQuestions,
            data.currentQuestion.effectiveDisplayMode,
            data.currentQuestion.passage?.id ?? null,
          ),
        ];
      }

      const questionLifecycle =
        (data.questionLifecycle as QuestionLifecycle) || "DISPLAYED";
      return {
        ...state,
        participantId: data.participantId,
        sessionTitle: data.sessionTitle || "Live Session",
        participantCount: data.participantCount || 0,
        sessionState: (data.status as SessionState) || "LOBBY",
        questionLifecycle,
        timeLeft:
          questionLifecycle === "DISPLAYED"
            ? null
            : (data.timeLeftSeconds ?? null),
        leaderboard: [],
        participantLeaderboard: [],
        finalLeaderboard: [],
        passage,
        questions,
        hydrated: true,
        liveTimerLimitSeconds: null,
      };
    }
    case "HYDRATED":
      return { ...state, hydrated: true };
    case "QUESTION_DISPLAYED": {
      const data = action.message;
      return {
        ...state,
        sessionState: "ACTIVE",
        questionLifecycle: "DISPLAYED",
        leaderboard: [],
        participantLeaderboard: [],
        finalLeaderboard: [],
        syncStatus: "idle",
        syncMessage: "",
        passage: data.passage
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
        questions: [buildQuestionFromDisplayed(data)],
        timeLeft: null,
        liveTimerLimitSeconds: null,
      };
    }
    case "PASSAGE_DISPLAYED": {
      const data = action.message;
      return {
        ...state,
        sessionState: "ACTIVE",
        questionLifecycle: "DISPLAYED",
        leaderboard: [],
        participantLeaderboard: [],
        finalLeaderboard: [],
        syncStatus: "idle",
        syncMessage: "",
        passage: {
          id: data.passageId,
          text: data.passageText,
          timerMode: "ENTIRE_PASSAGE",
          questionIndex: data.questionIndex,
          totalQuestions: data.totalQuestions,
          timeLimitSeconds: null,
          effectiveDisplayMode: data.effectiveDisplayMode,
        },
        questions: data.subQuestions.map((question, index) =>
          buildQuestionFromPassageSubQuestion(
            question,
            data.questionIndex + index,
            data.totalQuestions,
            data.timeLimitSeconds ?? 0,
            data.effectiveDisplayMode,
            data.passageId,
          ),
        ),
        timeLeft: null,
        liveTimerLimitSeconds: null,
      };
    }
    case "SESSION_END":
      return {
        ...state,
        sessionState: "ENDED",
        finalLeaderboard: action.leaderboard ?? state.finalLeaderboard,
        liveTimerLimitSeconds: null,
      };
    case "TIMER_START":
      return {
        ...state,
        sessionState: "ACTIVE",
        questionLifecycle: "TIMED",
        timeLeft: action.timeLimitSeconds,
        liveTimerLimitSeconds: action.timeLimitSeconds,
      };
    case "QUESTION_FROZEN":
      return {
        ...state,
        questionLifecycle: "FROZEN",
        timeLeft: 0,
        liveTimerLimitSeconds: null,
        questions: state.questions.map((question) => {
          const shouldFreeze =
            action.message.event === "PASSAGE_FROZEN" ||
            question.id === action.message.questionId;
          return shouldFreeze ? { ...question, lockedIn: true } : question;
        }),
      };
    case "QUESTION_REVIEWED": {
      const optionPoints = normalizePoints(action.optionPoints);
      const fromPoints = Object.entries(optionPoints)
        .filter(([, pts]) => pts > 0)
        .map(([id]) => Number(id));
      const mergedCorrect =
        fromPoints.length > 0
          ? fromPoints
          : normalizeIdList(action.correctOptionIds);
      return {
        ...state,
        questionLifecycle: "REVIEWING",
        questions: updateQuestion(state.questions, action.questionId, {
          correctOptionIds: mergedCorrect,
          optionPoints,
          reviewed: true,
          lockedIn: true,
        }),
      };
    }
    case "PARTICIPANT_LEADERBOARD":
      return {
        ...state,
        participantLeaderboard: action.leaderboard,
        leaderboard: action.leaderboard,
        participantCount: action.totalParticipants,
      };
    case "PARTICIPANT_JOINED":
      return { ...state, participantCount: action.count };
    case "ANSWER_UPDATE":
      return {
        ...state,
        questions: updateQuestion(state.questions, action.message.questionId, {
          counts: normalizeCounts(action.message.counts),
          totalAnswered: action.message.totalAnswered,
          totalLockedIn: action.message.totalLockedIn,
        }),
      };
    case "ANSWER_REVEAL":
      return {
        ...state,
        questions: updateQuestion(state.questions, action.message.questionId, {
          counts: normalizeCounts(action.message.counts),
          totalAnswered: action.message.totalAnswered,
          revealed: true,
        }),
      };
    case "TIMER_TICK":
      if (state.timeLeft === null || state.timeLeft <= 0) return state;
      return { ...state, timeLeft: state.timeLeft - 1 };
    case "SYNC_STATUS":
      return {
        ...state,
        syncStatus: action.status,
        syncMessage: action.message,
      };
    case "SET_SELECTION":
      return {
        ...state,
        questions: setQuestionSelection(
          state.questions,
          action.questionId,
          action.selectedOptionIds,
        ),
      };
    case "LOCKED_IN":
      return {
        ...state,
        questions: state.questions.map((question) =>
          question.id === action.questionId
            ? { ...question, lockedIn: true }
            : question,
        ),
      };
    case "LOCK_IN_ROLLBACK":
      return {
        ...state,
        questions: state.questions.map((question) =>
          question.id === action.questionId
            ? { ...question, lockedIn: false }
            : question,
        ),
      };
  }
}

export function usePlaySession(sessionId: string) {
  const router = useRouter();

  const [rejoinToken] = useState<string | null>(() => {
    return getStoredRejoinToken(sessionId);
  });
  const [session, dispatch] = useReducer(
    playSessionReducer,
    rejoinToken,
    initPlaySessionState,
  );
  const {
    sessionState,
    questionLifecycle,
    sessionTitle,
    participantCount,
    participantId,
    questions,
    passage,
    timeLeft,
    liveTimerLimitSeconds,
    leaderboard,
    participantLeaderboard,
    finalLeaderboard,
    hydrated,
    syncStatus,
    syncMessage,
  } = session;
  const timerRef = useRef<number | null>(null);
  const redirectRef = useRef(false);
  const pendingSelectionsRef = useRef(new Map<number, number[]>());
  const syncingQuestionPromisesRef = useRef(
    new Map<number, Promise<boolean>>(),
  );
  const syncInterruptRef = useRef(new Map<number, () => void>());
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

  const [lockInPendingByQuestionId, setLockInPendingByQuestionId] = useState<
    Record<number, true>
  >({});

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
      dispatch({ type: "TIMER_START", timeLimitSeconds: seconds });
      timerRef.current = window.setInterval(() => {
        dispatch({ type: "TIMER_TICK" });
      }, 1000);
    },
    [stopTimer],
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
          removeStoredRejoinToken(sessionId);
        }
        dispatch({ type: "HYDRATED" });
        return;
      }

      dispatch({ type: "REJOIN_LOADED", response: response.data });
    } catch (_e) {
      // ignore
    }
  }, [sessionId, rejoinToken]);

  const handleStompConnect = useCallback(() => {
    void loadSessionContext();
  }, [loadSessionContext]);

  const { subscribe, unsubscribe, publish, connected } = useStompClient({
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

  // Mobile browsers (especially iOS Safari) suspend/close WebSockets when the
  // tab is backgrounded. On return we resync via REST immediately so the UI is
  // live before the STOMP reconnect completes.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadSessionContext();
      }
    };

    const handleFocus = () => {
      void loadSessionContext();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadSessionContext]);

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
        dispatch({ type: "QUESTION_DISPLAYED", message: data });
        return;
      }

      if (data.event === "PASSAGE_DISPLAYED") {
        stopTimer();
        dispatch({ type: "PASSAGE_DISPLAYED", message: data });
        return;
      }

      if (data.event === "SESSION_END") {
        stopTimer();
        dispatch({ type: "SESSION_END", leaderboard: data.leaderboard });
        return;
      }

      if (data.event === "TIMER_START") {
        startTimer(data.timeLimitSeconds);
        return;
      }

      if (data.event === "QUESTION_FROZEN" || data.event === "PASSAGE_FROZEN") {
        stopTimer();
        dispatch({ type: "QUESTION_FROZEN", message: data });
        return;
      }

      if (
        data.event === "QUESTION_REVIEWED" ||
        data.event === "SCORING_CORRECTED"
      ) {
        dispatch({
          type: "QUESTION_REVIEWED",
          questionId: Number(data.questionId),
          correctOptionIds: normalizeIdList(data.correctOptionIds ?? []),
          optionPoints: normalizePoints(data.optionPoints ?? {}),
        });
        return;
      }

      if (data.event === "PARTICIPANT_LEADERBOARD") {
        dispatch({
          type: "PARTICIPANT_LEADERBOARD",
          leaderboard: data.leaderboard,
          totalParticipants: data.totalParticipants,
        });
        return;
      }

      if (data.event === "PARTICIPANT_JOINED") {
        dispatch({ type: "PARTICIPANT_JOINED", count: data.count });
        return;
      }

      if (data.event === "ANSWER_UPDATE") {
        dispatch({ type: "ANSWER_UPDATE", message: data });
        return;
      }

      if (data.event === "ANSWER_REVEAL") {
        dispatch({ type: "ANSWER_REVEAL", message: data });
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
  }, [sessionId, startTimer, stopTimer, subscribe, unsubscribe]);

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
    questionLifecycle === "DISPLAYED" || timeLeft === null
      ? "var(--color-muted)"
      : questionLifecycle === "TIMED" && timeLeft > 0
        ? timeLeft <= 5
          ? "var(--color-danger)"
          : timeLeft <= 10
            ? "var(--color-warning)"
            : "var(--color-foreground)"
        : questionLifecycle === "TIMED" && timeLeft <= 0
          ? "var(--color-danger)"
          : "var(--color-muted)";

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

  const anyLockInPending = useMemo(
    () => Object.keys(lockInPendingByQuestionId).length > 0,
    [lockInPendingByQuestionId],
  );

  const timerBarLimitSeconds = useMemo(() => {
    if (liveTimerLimitSeconds != null && liveTimerLimitSeconds > 0) {
      return liveTimerLimitSeconds;
    }
    const first = activeQuestions[0];
    if (!first) return 0;
    if (activePassage?.timerMode === "ENTIRE_PASSAGE") {
      return activePassage.timeLimitSeconds ?? first.timeLimitSeconds ?? 0;
    }
    return first.timeLimitSeconds ?? 0;
  }, [activePassage, activeQuestions, liveTimerLimitSeconds]);

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
        }, WS_ACK_TIMEOUT_MS);

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
      dispatch({
        type: "SYNC_STATUS",
        status: "retrying",
        message: "Realtime save stalled. Retrying.",
      });
      const response = await api.post<void>(
        `/api/sessions/${sessionId}/answers`,
        {
          rejoinToken,
          questionId,
          selectedOptionIds,
        },
      );
      if (!response.success) {
        dispatch({
          type: "SYNC_STATUS",
          status: "error",
          message: response.error?.message ?? "Failed to save answer",
        });
        void loadSessionContext();
        return false;
      }
      dispatch({ type: "SYNC_STATUS", status: "idle", message: "" });
      return true;
    },
    [loadSessionContext, rejoinToken, sessionId],
  );

  const fallbackLockIn = useCallback(
    async (questionId: number) => {
      if (!sessionId || !rejoinToken) return false;
      dispatch({
        type: "SYNC_STATUS",
        status: "retrying",
        message: "Realtime lock-in stalled. Retrying.",
      });
      const response = await api.post<void>(
        `/api/sessions/${sessionId}/lock-in`,
        {
          rejoinToken,
          questionId,
        },
      );
      if (!response.success) {
        const err = response.error;
        if (
          err?.code === "CONFLICT" &&
          typeof err.message === "string" &&
          err.message.toLowerCase().includes("frozen")
        ) {
          dispatch({ type: "SYNC_STATUS", status: "idle", message: "" });
          return true;
        }
        dispatch({
          type: "SYNC_STATUS",
          status: "error",
          message: err?.message ?? "Failed to lock in answer",
        });
        void loadSessionContext();
        return false;
      }
      dispatch({ type: "SYNC_STATUS", status: "idle", message: "" });
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
            dispatch({
              type: "SYNC_STATUS",
              status: "saving",
              message: "Saving answer.",
            });
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

            const ack = await Promise.race([
              ackPromise,
              new Promise<{
                success: boolean;
                code?: string;
                message?: string;
              }>((resolveInterrupt) => {
                syncInterruptRef.current.set(questionId, () =>
                  resolveInterrupt({ success: true, code: "SUPERSEDED" }),
                );
              }),
            ]);
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
              dispatch({
                type: "SYNC_STATUS",
                status: "error",
                message: ack.message ?? "Failed to save answer",
              });
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
            dispatch({ type: "SYNC_STATUS", status: "idle", message: "" });
            return true;
          }
        } finally {
          syncingQuestionPromisesRef.current.delete(questionId);
          syncInterruptRef.current.delete(questionId);
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
      if (lockInPendingByQuestionId[questionId]) return;

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

      dispatch({
        type: "SET_SELECTION",
        questionId,
        selectedOptionIds: nextSelection,
      });

      pendingSelectionsRef.current.set(
        questionId,
        normalizeSelectionIds(nextSelection),
      );
      syncInterruptRef.current.get(questionId)?.();
      if (process.env.NODE_ENV === "development")
        console.info("[play] toggle-option", {
          questionId,
          optionId,
          nextSelection: normalizeSelectionIds(nextSelection),
        });
      void syncAnswerSelection(questionId);
    },
    [
      lockInPendingByQuestionId,
      questionLifecycle,
      questions,
      rejoinToken,
      syncAnswerSelection,
    ],
  );

  const handleLockIn = useCallback(
    async (questionId: number) => {
      if (!rejoinToken) return;

      const question = questions.find((entry) => entry.id === questionId);
      if (
        !question ||
        question.lockedIn ||
        question.selectedOptionIds.length === 0 ||
        lockInPendingByQuestionId[questionId]
      ) {
        return;
      }

      setLockInPendingByQuestionId((prev) => ({ ...prev, [questionId]: true }));
      try {
        pendingSelectionsRef.current.set(
          questionId,
          normalizeSelectionIds(question.selectedOptionIds),
        );
        dispatch({
          type: "SYNC_STATUS",
          status: "saving",
          message: "Saving answer.",
        });
        const synced = await syncAnswerSelection(questionId);
        if (!synced) {
          dispatch({ type: "SYNC_STATUS", status: "idle", message: "" });
          return;
        }

        const clientRequestId = createClientRequestId();
        const ackPromise = waitForAnswerAck(clientRequestId);
        publish(`/app/session/${sessionId}/lock-in`, {
          rejoinToken,
          questionId,
          clientRequestId,
        });

        dispatch({ type: "LOCKED_IN", questionId });
        dispatch({ type: "SYNC_STATUS", status: "idle", message: "" });
        setLockInPendingByQuestionId((prev) => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });

        const ack = await ackPromise;
        if (!ack.success && ack.code === "TIMEOUT") {
          const fallbackSucceeded = await fallbackLockIn(questionId);
          if (!fallbackSucceeded) {
            dispatch({ type: "LOCK_IN_ROLLBACK", questionId });
            dispatch({
              type: "SYNC_STATUS",
              status: "error",
              message: "Could not confirm lock-in. Check your connection.",
            });
            void loadSessionContext();
            return;
          }
        } else if (!ack.success) {
          dispatch({ type: "LOCK_IN_ROLLBACK", questionId });
          dispatch({
            type: "SYNC_STATUS",
            status: "error",
            message: ack.message ?? "Failed to lock in answer",
          });
          void loadSessionContext();
          return;
        }
      } finally {
        setLockInPendingByQuestionId((prev) => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
      }
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
      lockInPendingByQuestionId,
    ],
  );

  const handleLockAll = useCallback(() => {
    lockableQuestions.forEach((question) => handleLockIn(question.id));
  }, [handleLockIn, lockableQuestions]);

  const handleLeave = useCallback(() => {
    removeStoredRejoinToken(sessionId);
  }, [sessionId]);

  return {
    session,
    sessionState,
    questionLifecycle,
    sessionTitle,
    participantCount,
    participantId,
    questions,
    passage,
    timeLeft,
    leaderboard,
    participantLeaderboard,
    finalLeaderboard,
    hydrated,
    syncStatus,
    syncMessage,
    rejoinToken,
    activePassage,
    activeQuestions,
    isPassage,
    maxQuestionIndex,
    selectedQuestionCount,
    timerColour,
    leaderboardRows,
    myLeaderboardEntry,
    topFive,
    lockableQuestions,
    canLockAll,
    anyLockInPending,
    lockInPendingByQuestionId,
    timerBarLimitSeconds,
    handleToggleOption,
    handleLockIn,
    handleLockAll,
    handleLeave,
    connected,
  };
}
