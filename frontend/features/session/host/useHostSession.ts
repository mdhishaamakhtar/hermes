"use client";

import { useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import { describeError, errorStatus } from "@/lib/api";
import { getStoredAuthToken } from "@/lib/auth";
import { getStoredJoinCode } from "@/lib/session-storage";
import { createLiveSync } from "../live-sync";
import { numberKeyed } from "../session-state";
import { sessionsApi } from "../session-api";
import type { HostSessionSync, SessionMessage } from "../session-types";
import { useStompClient } from "../useStompClient";
import {
  hostReducer,
  initialHostState,
  type HostAction,
  type HostState,
} from "./host-state";

export type HostControl =
  "start" | "start-timer" | "end-timer" | "next" | "end";

/**
 * Where the session stands: its status and, while it runs, the phase and
 * the questions on stage. Compared to tell whether a refused control was
 * pressed on a screen that had fallen behind.
 */
function stageKey(
  status: string,
  lifecycle: string | null,
  questionIds: number[],
): string {
  return status === "ACTIVE"
    ? `${status}|${lifecycle ?? ""}|${questionIds.join(",")}`
    : status;
}

function stageOf(state: HostState) {
  return stageKey(
    state.status,
    state.lifecycle,
    state.questions.map((question) => question.id),
  );
}

function syncStage(sync: HostSessionSync) {
  return stageKey(
    sync.status,
    sync.questionLifecycle,
    sync.currentPassage
      ? sync.currentPassage.subQuestions.map((question) => question.id)
      : sync.currentQuestion
        ? [sync.currentQuestion.id]
        : [],
  );
}

/**
 * The organiser's live session: REST snapshots on connect and on return to
 * the tab, STOMP messages in between, and the controls that drive it. Every
 * control reports its own failure; a host mid-session must never press a
 * button and see nothing happen. Nor does a control wait on the socket to
 * learn what it did: a backgrounded tab's socket can be quiet or dead, so
 * each one reads the session back before its button comes back.
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

  /** The stage in the latest snapshot applied. */
  const snapshotStage = useRef<string | null>(null);
  /** Set the instant a control is pressed, before `pending` renders. */
  const busy = useRef(false);

  const [live] = useState(() =>
    createLiveSync<HostAction>(dispatch, async () => {
      // Settled, not all: each call feeds its own slice, and host-sync fails
      // once a session has ended and its live state is gone. Status comes
      // from the database, so it alone decides whether the session exists.
      const [sync, lobby, status] = await Promise.allSettled([
        sessionsApi.hostSync(sessionId),
        sessionsApi.lobby(sessionId),
        sessionsApi.status(sessionId),
      ]);
      if (sync.status === "fulfilled") {
        snapshotStage.current = syncStage(sync.value);
        dispatch({ type: "SYNC", sync: sync.value });
      }
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
      return (
        sync.status === "fulfilled" ||
        lobby.status === "fulfilled" ||
        status.status === "fulfilled"
      );
    }),
  );

  const token = getStoredAuthToken();
  const { subscribe, unsubscribe, connected } = useStompClient({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    onConnect: () => void live.resync(),
  });

  const onMessage = useEffectEvent((message: SessionMessage) => {
    const action = toAction(message);
    if (action) live.event(action);
    if (message.event === "SESSION_END") void loadResults();
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

  // Resync on arrival, and when the host comes back to the tab: timers drift
  // and messages can be missed while a laptop sleeps or the tab sits behind
  // another.
  const resync = useEffectEvent(() => void live.resync());
  useEffect(() => {
    resync();
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
    // A clicker can send its key twice inside one frame, before the
    // re-render that disables the button.
    if (busy.current) return;
    busy.current = true;
    const pressedOn = stageOf(state);
    setPending(control);
    setControlError(null);
    try {
      await call();
      // Read back what the control did rather than wait for the socket to
      // say so, and keep the button busy until the screen shows it.
      await live.resync();
    } catch (err) {
      if (errorStatus(err) === 409) {
        // Refused because the session isn't where this screen showed it:
        // usually it already did this (a tab that sat in the background, a
        // second press). Catch up, and only explain if nothing moved.
        snapshotStage.current = null;
        await live.resync();
        if (
          snapshotStage.current !== null &&
          snapshotStage.current !== pressedOn
        )
          return;
      }
      setControlError(describeError(err, failure));
    } finally {
      busy.current = false;
      setPending(null);
    }
  };

  const lastQuestion = state.questions.at(-1);

  return {
    ...state,
    sessionId,
    connected,
    loadError: state.hydrated ? null : loadError,
    retry: () => void live.resync(),
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
          () => sessionsApi.start(sessionId),
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

/**
 * The reducer action a live message stands for. Lifecycle events and joins
 * arrive on the question topic; counts and standings on analytics.
 */
function toAction(message: SessionMessage): HostAction | null {
  switch (message.event) {
    case "QUESTION_DISPLAYED":
      return { type: "QUESTION_DISPLAYED", message };
    case "PASSAGE_DISPLAYED":
      return { type: "PASSAGE_DISPLAYED", message };
    case "TIMER_START":
      return { type: "TIMER_START", seconds: message.timeLimitSeconds };
    case "QUESTION_FROZEN":
    case "PASSAGE_FROZEN":
      return { type: "FROZEN" };
    case "QUESTION_REVIEWED":
    case "SCORING_CORRECTED":
      return {
        type: "REVIEWED",
        questionId: Number(message.questionId),
        correctOptionIds: (message.correctOptionIds ?? []).map(Number),
        optionPoints: numberKeyed(message.optionPoints),
        correction: message.event === "SCORING_CORRECTED",
      };
    case "PARTICIPANT_JOINED":
      return { type: "PARTICIPANTS", count: message.count };
    case "ANSWER_UPDATE":
    case "ANSWER_REVEAL":
      return { type: "ANSWERS", message };
    case "LEADERBOARD_UPDATE":
      return { type: "LEADERBOARD", leaderboard: message.leaderboard };
    case "SESSION_END":
      return { type: "ENDED", leaderboard: message.leaderboard };
    default:
      return null;
  }
}
