"use client";

/**
 * The organiser session hook: STOMP wiring, session controls, results loading,
 * and the scoring-correction drawer.
 *
 * Types, stats helpers, the reducer, and the question-card adapters live in
 * sibling modules (host-types, host-stats, host-reducer, host-question-cards)
 * and are re-exported below so every existing import path keeps working.
 * Nothing about the realtime behaviour changed when they were split out.
 */
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { sessionsApi } from "@/features/session/session-api";
import { apiErrorMessage } from "@/lib/api";
import { getStoredAuthToken } from "@/lib/auth-storage";
import { useStompClient } from "@/hooks/useStompClient";
import { normalizeIdList, normalizePoints } from "@/lib/session-utils";
import type { CorrectionDraftOption } from "@/components/session/ScoringDrawer";
import type { QuestionCardData } from "@/components/session/QuestionCard";
import { hostSessionReducer, initHostSessionState } from "./host-reducer";
import { DEFAULT_STATS, displayModeLabel } from "./host-stats";
import type {
  AnswerRevealMsg,
  AnswerUpdateMsg,
  LeaderboardUpdateMsg,
  ParticipantLeaderboardMsg,
  PassageDisplayedMsg,
  QuestionDisplayedMsg,
  SessionEndMsg,
} from "./host-types";
import type {
  TimerStartMsg,
  QuestionFrozenMsg,
  PassageFrozenMsg,
  QuestionReviewedMsg,
  ScoringCorrectedMsg,
} from "@/features/session/shared/session-types";

export * from "./host-types";
export { displayModeLabel } from "./host-stats";
export { hostSessionReducer, initHostSessionState } from "./host-reducer";
export {
  buildActiveQuestionCard,
  buildResultsQuestionCard,
} from "./host-question-cards";

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
    try {
      const results = await sessionsApi.results(id);
      dispatch({ type: "RESULTS_LOADED", results });
    } catch {
      // Keep whatever results are already on screen.
    }
  }, [id]);

  const loadSessionContext = useCallback(async () => {
    if (!id) return;

    // allSettled, not all: each of the three feeds a different slice of state
    // and any of them may fail on its own. Rejecting the whole batch would
    // also skip the terminal CONTEXT_LOADED dispatch that clears loading.
    const [syncResult, lobbyResult, statusResult] = await Promise.allSettled([
      sessionsApi.hostSync(id),
      sessionsApi.lobby(id),
      sessionsApi.sessionStatus(id),
    ]);

    if (syncResult.status === "fulfilled") {
      dispatch({ type: "SYNC_LOADED", sync: syncResult.value });
    }

    if (lobbyResult.status === "fulfilled") {
      dispatch({ type: "CONTEXT_LOADED", lobby: lobbyResult.value });
    }

    if (statusResult.status === "fulfilled") {
      dispatch({ type: "CONTEXT_LOADED", status: statusResult.value });
      if (statusResult.value === "ENDED") {
        void loadResults();
      }
    }

    dispatch({ type: "CONTEXT_LOADED" });
  }, [id, loadResults]);

  const { subscribe, unsubscribe, connected } = useStompClient({
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
          questionId: Number(data.questionId),
          correctOptionIds: normalizeIdList(data.correctOptionIds ?? []),
          optionPoints: normalizePoints(data.optionPoints ?? {}),
        });
        return;
      }

      if (data.event === "SCORING_CORRECTED") {
        dispatch({
          type: "QUESTION_REVIEWED",
          questionId: Number(data.questionId),
          correctOptionIds: normalizeIdList(data.correctOptionIds ?? []),
          optionPoints: normalizePoints(data.optionPoints ?? {}),
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

  const currentQuestions = useMemo(() => {
    if (activePassage?.subQuestions.length) {
      return activePassage.subQuestions;
    }
    return activeQuestion ? [activeQuestion] : [];
  }, [activePassage, activeQuestion]);

  const primaryQuestion = currentQuestions[0] ?? null;

  const reviewProgressQuestionIds = useMemo(() => {
    if (sessionStatus === "ENDED") {
      return (
        sessionResults?.questions
          ?.toSorted((a, b) => a.orderIndex - b.orderIndex)
          .map((q) => q.id) ?? []
      );
    }
    return currentQuestions.map((q) => q.id);
  }, [sessionStatus, sessionResults?.questions, currentQuestions]);

  const currentQuestionStats = primaryQuestion
    ? (questionStatsById[primaryQuestion.id] ?? DEFAULT_STATS())
    : DEFAULT_STATS();

  const canAdvance =
    questionLifecycle === "REVIEWING" &&
    reviewProgressQuestionIds.length > 0 &&
    reviewProgressQuestionIds.every((questionId) => {
      const stats = questionStatsById[questionId];
      return stats?.reviewed ?? sessionStatus === "ENDED";
    });

  const timerColour =
    questionLifecycle === "TIMED"
      ? timeLeft <= 5
        ? "var(--color-danger)"
        : timeLeft <= 10
          ? "var(--color-warning)"
          : "var(--color-foreground)"
      : "var(--color-muted)";

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

  // Every host control clears its loading state in `finally`: a failed call
  // must never leave the button stuck mid-action during a live session.
  const handleStartSession = useCallback(async () => {
    if (!id) return;
    setLoadingAction("start-session");
    try {
      await sessionsApi.start(id);
      dispatch({ type: "SESSION_STARTED" });
    } catch {
      // Session did not start; the lobby controls stay as they were.
    } finally {
      setLoadingAction(null);
    }
  }, [id]);

  const handleStartTimer = useCallback(async () => {
    if (!id) return;
    setLoadingAction("start-timer");
    try {
      await sessionsApi.startTimer(id);
    } catch {
      // The authoritative timer state arrives over STOMP regardless.
    } finally {
      setLoadingAction(null);
    }
  }, [id]);

  const handleEndTimerEarly = useCallback(async () => {
    if (!id) return;
    setLoadingAction("end-timer");
    try {
      await sessionsApi.endTimer(id);
    } catch {
      // The authoritative timer state arrives over STOMP regardless.
    } finally {
      setLoadingAction(null);
    }
  }, [id]);

  const handleNextQuestion = useCallback(async () => {
    if (!id) return;
    setLoadingAction("next");
    try {
      await sessionsApi.next(id);
    } catch {
      // QUESTION_START over STOMP is what actually advances the view.
    } finally {
      setLoadingAction(null);
    }
  }, [id]);

  const handleForceEnd = useCallback(async () => {
    if (!id) return;
    setLoadingAction("end-session");
    try {
      await sessionsApi.end(id);
      await loadResults();
      dispatch({ type: "SESSION_END" });
    } catch {
      // Session did not end; the host stays on the live view.
    } finally {
      setLoadingAction(null);
    }
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
      await sessionsApi.correctScoring(id, scoringQuestionId, payload);

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
    } catch (err) {
      setScoringError(apiErrorMessage(err, "Failed to update scoring."));
    } finally {
      setDrawerSaving(false);
    }
  }, [id, loadResults, scoringDraft, scoringQuestionId, sessionStatus]);

  const activeModeLabel = displayModeLabel(effectiveDisplayMode);
  const progressLabel =
    questionIndex > 0 && totalQuestions > 0
      ? `Q${questionIndex} / ${totalQuestions}`
      : "Awaiting question";

  const isLastQuestion =
    questionIndex > 0 && totalQuestions > 0 && questionIndex >= totalQuestions;

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
    isLastQuestion,
    connected,
  };
}
