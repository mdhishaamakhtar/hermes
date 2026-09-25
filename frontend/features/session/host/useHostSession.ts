"use client";

import { useEffect, useEffectEvent, useReducer, useState } from "react";
import { describeError } from "@/lib/api";
import { getStoredAuthToken } from "@/lib/auth";
import { getStoredJoinCode } from "@/lib/session-storage";
import { numberKeyed } from "../session-state";
import { sessionsApi } from "../session-api";
import type { SessionMessage } from "../session-types";
import { useStompClient } from "../useStompClient";
import { hostReducer, initialHostState } from "./host-state";

export type HostControl =
  "start" | "start-timer" | "end-timer" | "next" | "end";

/**
 * The organiser's live session: REST snapshots on connect and on return to
 * the tab, STOMP messages in between, and the controls that drive it. Every
 * control reports its own failure; a host mid-session must never press a
 * button and see nothing happen.
 */
export function useHostSession(sessionId: string) {
  const [state, dispatch] = useReducer(hostReducer, sessionId, (id) =>
    initialHostState(getStoredJoinCode(id)),
  );
  const [loadError, setLoadError] = useState<unknown>(null);
  const [pending, setPending] = useState<HostControl | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);

  const loadResults = async () => {
    try {
      dispatch({
        type: "RESULTS",
        results: await sessionsApi.results(sessionId),
      });
    } catch {
      // Keep whatever results are already on screen.
    }
  };

  const loadContext = async () => {
    // Settled, not all: each call feeds its own slice, and host-sync fails
    // once a session has ended and its live state is gone. Status comes from
    // the database, so it alone decides whether the session exists at all.
    const [sync, lobby, status] = await Promise.allSettled([
      sessionsApi.hostSync(sessionId),
      sessionsApi.lobby(sessionId),
      sessionsApi.status(sessionId),
    ]);
    if (sync.status === "fulfilled")
      dispatch({ type: "SYNC", sync: sync.value });
    if (lobby.status === "fulfilled") {
      dispatch({ type: "LOBBY", lobby: lobby.value });
    }
    if (status.status === "fulfilled") {
      setLoadError(null);
      dispatch({ type: "STATUS", status: status.value });
      if (status.value === "ENDED") void loadResults();
    } else {
      setLoadError(status.reason);
    }
  };

  const token = getStoredAuthToken();
  const { subscribe, unsubscribe, connected } = useStompClient({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    onConnect: () => void loadContext(),
  });

  const onMessage = useEffectEvent((message: SessionMessage) => {
    switch (message.event) {
      case "QUESTION_DISPLAYED":
        return dispatch({ type: "QUESTION_DISPLAYED", message });
      case "PASSAGE_DISPLAYED":
        return dispatch({ type: "PASSAGE_DISPLAYED", message });
      case "TIMER_START":
        return dispatch({
          type: "TIMER_START",
          seconds: message.timeLimitSeconds,
        });
      case "QUESTION_FROZEN":
      case "PASSAGE_FROZEN":
        return dispatch({ type: "FROZEN" });
      case "QUESTION_REVIEWED":
      case "SCORING_CORRECTED":
        return dispatch({
          type: "REVIEWED",
          questionId: Number(message.questionId),
          correctOptionIds: (message.correctOptionIds ?? []).map(Number),
          optionPoints: numberKeyed(message.optionPoints),
          correction: message.event === "SCORING_CORRECTED",
        });
      case "PARTICIPANT_JOINED":
        return dispatch({ type: "PARTICIPANTS", count: message.count });
      case "ANSWER_UPDATE":
      case "ANSWER_REVEAL":
        return dispatch({ type: "ANSWERS", message });
      case "LEADERBOARD_UPDATE":
        return dispatch({
          type: "LEADERBOARD",
          leaderboard: message.leaderboard,
        });
      case "SESSION_END":
        dispatch({ type: "ENDED", leaderboard: message.leaderboard });
        void loadResults();
    }
  });

  useEffect(() => {
    // Lifecycle events and joins arrive on the question topic; counts and
    // standings on analytics. The question topic also repeats counts for
    // players, so the organiser takes those from analytics alone.
    const questionTopic = `/topic/session.${sessionId}.question`;
    const analyticsTopic = `/topic/session.${sessionId}.analytics`;
    const lifecycleOnly = new Set([
      "ANSWER_UPDATE",
      "ANSWER_REVEAL",
      "PARTICIPANT_LEADERBOARD",
    ]);

    subscribe(questionTopic, (body) => {
      const message = body as SessionMessage;
      if (!lifecycleOnly.has(message.event)) onMessage(message);
    });
    subscribe(analyticsTopic, (body) => onMessage(body as SessionMessage));

    return () => {
      unsubscribe(questionTopic);
      unsubscribe(analyticsTopic);
    };
  }, [sessionId, subscribe, unsubscribe]);

  useEffect(() => {
    if (state.status !== "ACTIVE" || state.lifecycle !== "TIMED") return;
    const interval = window.setInterval(
      () => dispatch({ type: "TIMER_TICK" }),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [state.status, state.lifecycle]);

  // Resync when the host comes back to the tab: timers drift and messages
  // can be missed while a laptop sleeps.
  const resync = useEffectEvent(() => void loadContext());
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", resync);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", resync);
    };
  }, []);

  const run = async (
    control: HostControl,
    call: () => Promise<unknown>,
    failure: string,
  ) => {
    setPending(control);
    setControlError(null);
    try {
      await call();
    } catch (err) {
      setControlError(describeError(err, failure));
    } finally {
      setPending(null);
    }
  };

  const lastQuestion = state.questions.at(-1);

  return {
    ...state,
    sessionId,
    connected,
    loadError: state.hydrated ? null : loadError,
    retry: () => void loadContext(),
    pending,
    controlError,
    dismissControlError: () => setControlError(null),
    /** Every question on stage has been graded, so the host may move on. */
    canAdvance:
      state.lifecycle === "REVIEWING" &&
      state.questions.length > 0 &&
      state.questions.every((question) => state.stats[question.id]?.reviewed),
    isLastQuestion:
      lastQuestion !== undefined &&
      state.totalQuestions > 0 &&
      lastQuestion.number >= state.totalQuestions,

    controls: {
      start: () =>
        run(
          "start",
          async () => {
            await sessionsApi.start(sessionId);
            dispatch({ type: "STARTED" });
          },
          "Couldn't start the session.",
        ),
      startTimer: () =>
        run(
          "start-timer",
          () => sessionsApi.startTimer(sessionId),
          "Couldn't start the timer.",
        ),
      endTimer: () =>
        run(
          "end-timer",
          () => sessionsApi.endTimer(sessionId),
          "Couldn't stop the timer.",
        ),
      next: () =>
        run(
          "next",
          () => sessionsApi.next(sessionId),
          "Couldn't move on to the next question.",
        ),
      end: () =>
        run(
          "end",
          async () => {
            await sessionsApi.end(sessionId);
            dispatch({ type: "ENDED" });
            await loadResults();
          },
          "Couldn't end the session.",
        ),
    },

    /** Re-score a graded question; the leaderboard recalculates on the server. */
    async correctScoring(
      questionId: number,
      points: Array<{ optionId: number; pointValue: number }>,
    ) {
      await sessionsApi.correctScoring(sessionId, questionId, points);
      dispatch({
        type: "REVIEWED",
        questionId,
        correctOptionIds: points
          .filter((option) => option.pointValue > 0)
          .map((option) => option.optionId),
        optionPoints: Object.fromEntries(
          points.map((option) => [option.optionId, option.pointValue]),
        ),
        correction: true,
      });
      if (state.status === "ENDED") await loadResults();
    },
  };
}

export type HostSession = ReturnType<typeof useHostSession>;
