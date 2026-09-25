"use client";

import { useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { describeError, errorStatus, HermesError } from "@/lib/api";
import { forgetPlayer } from "@/lib/session-storage";
import { numberKeyed } from "../session-state";
import { sessionsApi } from "../session-api";
import type { AnswerAckMsg, SessionMessage } from "../session-types";
import { useStompClient } from "../useStompClient";
import { initialPlayState, playReducer } from "./play-state";

/**
 * How long to wait for the realtime acknowledgement of an answer before
 * sending it again over HTTP. A normal round trip is well under 100ms; two
 * seconds leaves room for a poor mobile connection.
 */
const ACK_TIMEOUT_MS = 2000;

type Ack =
  | { ok: true; superseded?: boolean }
  | { ok: false; timedOut: boolean; message?: string };

function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const selectionKey = (ids: number[]) => ids.toSorted((a, b) => a - b).join(",");

/**
 * A player's live session. Answers go out over STOMP and wait for an
 * acknowledgement; if none arrives they are resent over HTTP. A newer
 * selection supersedes one still in flight, so rapid taps settle on the last
 * choice rather than racing each other.
 */
export function usePlaySession(sessionId: string, rejoinToken: string) {
  const router = useRouter();
  const [state, dispatch] = useReducer(playReducer, initialPlayState);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [lockPending, setLockPending] = useState<Record<number, true>>({});

  /** The selection each question should end up with on the server. */
  const wanted = useRef(new Map<number, number[]>());
  /** The sync loop running for a question, so a second caller joins it. */
  const syncing = useRef(new Map<number, Promise<boolean>>());
  /** Cuts short a wait for an ack that a newer selection has replaced. */
  const supersede = useRef(new Map<number, () => void>());
  const acks = useRef(
    new Map<string, { resolve: (ack: Ack) => void; timeout: number }>(),
  );
  const redirected = useRef(false);

  const loadContext = async () => {
    try {
      dispatch({
        type: "REJOINED",
        response: await sessionsApi.rejoin(sessionId, rejoinToken),
      });
      setLoadError(null);
    } catch (err) {
      // Every refusal is a 404: the server no longer knows this player here
      // (the session was discarded, or the token expired). That is final.
      if (errorStatus(err) === 404) {
        forgetPlayer(sessionId);
        dispatch({ type: "MISSING" });
        return;
      }
      // Anything else is the connection; the next reconnect tries again.
      setLoadError(err);
    }
  };

  const { subscribe, unsubscribe, publish, connected } = useStompClient({
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
        return dispatch({ type: "FROZEN", questionId: message.questionId });
      case "PASSAGE_FROZEN":
        return dispatch({ type: "FROZEN", questionId: null });
      case "QUESTION_REVIEWED":
      case "SCORING_CORRECTED":
        return dispatch({
          type: "REVIEWED",
          questionId: Number(message.questionId),
          correctOptionIds: (message.correctOptionIds ?? []).map(Number),
          optionPoints: numberKeyed(message.optionPoints),
          correction: message.event === "SCORING_CORRECTED",
        });
      case "PARTICIPANT_LEADERBOARD":
        return dispatch({
          type: "LEADERBOARD",
          leaderboard: message.leaderboard,
          totalParticipants: message.totalParticipants,
        });
      case "PARTICIPANT_JOINED":
        return dispatch({ type: "PARTICIPANTS", count: message.count });
      case "ANSWER_UPDATE":
      case "ANSWER_REVEAL":
        return dispatch({ type: "ANSWERS", message });
      case "SESSION_END":
        return dispatch({ type: "ENDED" });
    }
  });

  const onAck = useEffectEvent((ack: AnswerAckMsg) => {
    const waiting = acks.current.get(ack.clientRequestId);
    if (!waiting) return;
    window.clearTimeout(waiting.timeout);
    acks.current.delete(ack.clientRequestId);
    waiting.resolve(
      ack.event === "ANSWER_ACCEPTED"
        ? { ok: true }
        : { ok: false, timedOut: false, message: ack.message },
    );
  });

  useEffect(() => {
    // Players cannot subscribe to analytics; the backend repeats joins and
    // answer counts on the question topic for them.
    const questionTopic = `/topic/session.${sessionId}.question`;
    const ackQueue = "/user/queue/answers";
    subscribe(questionTopic, (body) => onMessage(body as SessionMessage));
    subscribe(ackQueue, (body) => onAck(body as AnswerAckMsg));
    return () => {
      unsubscribe(questionTopic);
      unsubscribe(ackQueue);
    };
  }, [sessionId, subscribe, unsubscribe]);

  // Settle every outstanding wait when the screen goes away.
  useEffect(() => {
    const pending = acks.current;
    return () => {
      pending.forEach(({ timeout, resolve }) => {
        window.clearTimeout(timeout);
        resolve({ ok: false, timedOut: false, message: "Connection closed." });
      });
      pending.clear();
    };
  }, []);

  useEffect(() => {
    if (state.status !== "ACTIVE" || state.lifecycle !== "TIMED") return;
    const interval = window.setInterval(
      () => dispatch({ type: "TIMER_TICK" }),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [state.status, state.lifecycle]);

  // Mobile browsers suspend sockets in the background; resync over REST the
  // moment the player returns, before STOMP has even reconnected.
  const resync = useEffectEvent(() => void loadContext());
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

  useEffect(() => {
    if (state.status !== "ENDED" || redirected.current) return;
    redirected.current = true;
    router.replace(`/session/${sessionId}/results`);
  }, [router, sessionId, state.status]);

  const awaitAck = (requestId: string) =>
    new Promise<Ack>((resolve) => {
      const timeout = window.setTimeout(() => {
        acks.current.delete(requestId);
        resolve({ ok: false, timedOut: true });
      }, ACK_TIMEOUT_MS);
      acks.current.set(requestId, { resolve, timeout });
    });

  const fail = (message: string) => {
    dispatch({ type: "SYNC", status: "error", message });
    void loadContext();
  };

  /** Push the wanted selection for a question until the server holds it. */
  const syncSelection = (questionId: number): Promise<boolean> => {
    const running = syncing.current.get(questionId);
    if (running) return running;

    const loop = (async () => {
      try {
        for (;;) {
          const selection = wanted.current.get(questionId);
          if (!selection) return true;

          const requestId = newRequestId();
          const ack = awaitAck(requestId);
          dispatch({ type: "SYNC", status: "saving" });
          publish(`/app/session/${sessionId}/answer`, {
            rejoinToken,
            questionId,
            selectedOptionIds: selection,
            clientRequestId: requestId,
          });

          const result = await Promise.race([
            ack,
            new Promise<Ack>((resolve) =>
              supersede.current.set(questionId, () =>
                resolve({ ok: true, superseded: true }),
              ),
            ),
          ]);

          if (!result.ok && result.timedOut) {
            dispatch({
              type: "SYNC",
              status: "retrying",
              message: "Connection is slow. Retrying your answer…",
            });
            try {
              await sessionsApi.submitAnswer(sessionId, {
                rejoinToken,
                questionId,
                selectedOptionIds: selection,
              });
            } catch (err) {
              wanted.current.delete(questionId);
              fail(describeError(err, "Your answer didn't save."));
              return false;
            }
          } else if (!result.ok) {
            wanted.current.delete(questionId);
            fail(result.message ?? "Your answer didn't save.");
            return false;
          }

          const latest = wanted.current.get(questionId);
          if (latest && selectionKey(latest) !== selectionKey(selection)) {
            continue;
          }
          wanted.current.delete(questionId);
          dispatch({ type: "SYNC", status: "idle" });
          return true;
        }
      } finally {
        syncing.current.delete(questionId);
        supersede.current.delete(questionId);
      }
    })();

    syncing.current.set(questionId, loop);
    return loop;
  };

  const toggleOption = (questionId: number, optionId: number) => {
    if (state.lifecycle !== "TIMED" || lockPending[questionId]) return;
    const question = state.questions.find((q) => q.id === questionId);
    if (!question || question.lockedIn) return;

    const alreadySelected = question.selected.includes(optionId);
    let selected: number[];
    if (question.questionType === "MULTI_SELECT") {
      selected = alreadySelected
        ? question.selected.filter((id) => id !== optionId)
        : [...question.selected, optionId];
    } else {
      if (alreadySelected) return;
      selected = [optionId];
    }

    dispatch({ type: "SELECT", questionId, selected });
    wanted.current.set(questionId, selected);
    supersede.current.get(questionId)?.();
    void syncSelection(questionId);
  };

  const clearLockPending = (questionId: number) =>
    setLockPending((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });

  const lockIn = async (questionId: number) => {
    const question = state.questions.find((q) => q.id === questionId);
    if (
      !question ||
      question.lockedIn ||
      question.selected.length === 0 ||
      lockPending[questionId]
    ) {
      return;
    }

    setLockPending((current) => ({ ...current, [questionId]: true }));
    try {
      // Make sure the server holds this exact selection before freezing it.
      wanted.current.set(questionId, question.selected);
      if (!(await syncSelection(questionId))) return;

      const requestId = newRequestId();
      const ack = awaitAck(requestId);
      publish(`/app/session/${sessionId}/lock-in`, {
        rejoinToken,
        questionId,
        clientRequestId: requestId,
      });
      // Optimistic: the answer reads as locked while the ack is in flight.
      dispatch({ type: "LOCKED", questionId, lockedIn: true });
      dispatch({ type: "SYNC", status: "idle" });
      clearLockPending(questionId);

      const result = await ack;
      if (result.ok) return;

      if (result.timedOut) {
        dispatch({
          type: "SYNC",
          status: "retrying",
          message: "Connection is slow. Retrying your lock-in…",
        });
        try {
          await sessionsApi.lockIn(sessionId, { rejoinToken, questionId });
          dispatch({ type: "SYNC", status: "idle" });
          return;
        } catch (err) {
          // Already frozen means the server did what we asked, just sooner.
          const alreadyFrozen =
            err instanceof HermesError &&
            err.code === "CONFLICT" &&
            err.message.toLowerCase().includes("frozen");
          if (alreadyFrozen) {
            dispatch({ type: "SYNC", status: "idle" });
            return;
          }
        }
      }
      dispatch({ type: "LOCKED", questionId, lockedIn: false });
      fail(
        result.timedOut
          ? "Couldn't confirm your lock-in. Check your connection."
          : (result.message ?? "Couldn't lock in your answer."),
      );
    } finally {
      clearLockPending(questionId);
    }
  };

  const lockable = state.questions.filter(
    (question) =>
      state.lifecycle === "TIMED" &&
      !question.lockedIn &&
      question.selected.length > 0,
  );

  return {
    ...state,
    connected,
    loadError: state.hydrated ? null : loadError,
    retry: () => void loadContext(),
    lockPending,
    lockable,
    toggleOption,
    lockIn,
    lockAll: () => lockable.forEach((question) => void lockIn(question.id)),
    leave: () => forgetPlayer(sessionId),
  };
}

export type PlaySession = ReturnType<typeof usePlaySession>;
