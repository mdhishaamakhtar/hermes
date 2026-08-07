"use client";

/**
 * The participant session hook: STOMP wiring, answer submission with an HTTP
 * fallback, and the countdown timer.
 *
 * Types, question builders, and the reducer live in sibling modules
 * (play-types, play-questions, play-reducer) and are re-exported below so
 * every existing import path keeps working. Nothing about the realtime
 * behaviour changed when they were split out.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api, apiErrorMessage, HermesError } from "@/lib/api";
import { getStoredAuthToken } from "@/lib/auth-storage";
import { useStompClient } from "@/hooks/useStompClient";
import { normalizeIdList, normalizePoints } from "@/lib/session-utils";
import {
  getStoredRejoinToken,
  removeStoredRejoinToken,
} from "@/lib/session-storage";
import type { RejoinResponse } from "@/lib/types";
import { createClientRequestId, normalizeSelectionIds } from "./play-questions";
import { initPlaySessionState, playSessionReducer } from "./play-reducer";
import type {
  AnalyticsEventMsg,
  AnswerAckMsg,
  QuestionEventMsg,
} from "./play-types";

export * from "./play-types";
export {
  formatQuestionSpanLabel,
  sumQuestionPoints,
  sumVisibleQuestionsPoints,
} from "./play-questions";
export { initPlaySessionState, playSessionReducer } from "./play-reducer";

/**
 * Max wait for a STOMP answer/lock-in ack before falling back to HTTP.
 * Typical RabbitMQ round-trip is <100ms; 2000ms gives ample headroom for
 * high-latency clients.
 */
const WS_ACK_TIMEOUT_MS = 2000;

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
      dispatch({ type: "REJOIN_LOADED", response });
    } catch (err) {
      // A refusal from the server is final — settle into the hydrated state.
      // A request that never landed is not: stay unhydrated so the next
      // reconnect retries rather than rendering an empty session.
      if (err instanceof HermesError && err.isFromServer) {
        if (err.code === "NOT_FOUND") removeStoredRejoinToken(sessionId);
        dispatch({ type: "HYDRATED" });
      }
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
      try {
        await api.post<void>(`/api/sessions/${sessionId}/answers`, {
          rejoinToken,
          questionId,
          selectedOptionIds,
        });
      } catch (err) {
        dispatch({
          type: "SYNC_STATUS",
          status: "error",
          message: apiErrorMessage(err, "Failed to save answer"),
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
      try {
        await api.post<void>(`/api/sessions/${sessionId}/lock-in`, {
          rejoinToken,
          questionId,
        });
      } catch (err) {
        // Already frozen means the server did what we asked, just earlier —
        // treat it as success rather than alarming the participant.
        const alreadyFrozen =
          err instanceof HermesError &&
          err.code === "CONFLICT" &&
          err.message.toLowerCase().includes("frozen");
        if (alreadyFrozen) {
          dispatch({ type: "SYNC_STATUS", status: "idle", message: "" });
          return true;
        }
        dispatch({
          type: "SYNC_STATUS",
          status: "error",
          message: apiErrorMessage(err, "Failed to lock in answer"),
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
