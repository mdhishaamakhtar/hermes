"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getStoredAuthToken } from "@/lib/auth-storage";
import { useStompClient } from "@/hooks/useStompClient";
import { OPTION_META } from "@/lib/session-constants";
import { colorRgb } from "@/lib/design-tokens";
import Spinner from "@/components/Spinner";

interface OptionData {
  id: number;
  text: string;
  orderIndex: number;
}

interface QuestionData {
  id: number;
  text: string;
  orderIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number;
  options: OptionData[];
}

type SessionState = "LOBBY" | "ACTIVE" | "ENDED";

interface WsMessage {
  event: string;
  questionId?: number;
  text?: string;
  options?: OptionData[];
  timeLimitSeconds?: number;
  questionIndex?: number;
  totalQuestions?: number;
  correctOptionId?: number;
  count?: number;
}

export default function PlayPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();

  const [sessionState, setSessionState] = useState<SessionState>("LOBBY");
  const [sessionName, setSessionName] = useState("");
  const [participantCount, setParticipantCount] = useState(0);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  const [correctOptionId, setCorrectOptionId] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [rejoinToken] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(`hermes_rejoin_${sessionId}`)
      : null,
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const authToken = getStoredAuthToken();
  const { subscribe, publish, unsubscribe } = useStompClient({
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    api
      .post<{
        status: string;
        sessionTitle: string;
        participantCount: number;
        currentQuestion?: QuestionData;
        timeLeftSeconds?: number;
      }>(`/api/sessions/rejoin`, {
        sessionId: Number(sessionId),
        rejoinToken,
      })
      .then((res) => {
        if (!res.success) return;
        const d = res.data;
        setSessionName(d.sessionTitle || "Quiz Session");
        setParticipantCount(d.participantCount || 0);
        if (d.status === "ACTIVE") {
          setSessionState("ACTIVE");
          if (d.currentQuestion) {
            setQuestion(d.currentQuestion);
            if (d.timeLeftSeconds != null) startTimer(d.timeLeftSeconds);
          }
        } else if (d.status === "ENDED") {
          router.replace(`/session/${sessionId}/results`);
        }
      })
      .catch(() => {});

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId, rejoinToken, router, startTimer]);

  // Block back navigation during active quiz
  useEffect(() => {
    if (sessionState !== "ACTIVE") return;
    window.history.pushState(null, "", window.location.href);
    const onPopState = () =>
      window.history.pushState(null, "", window.location.href);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [sessionState]);

  useEffect(() => {
    if (!sessionId) return;

    const dest = `/topic/session.${sessionId}.question`;
    subscribe(dest, (msg) => {
      const message = msg as WsMessage;

      if (message.event === "QUESTION_START") {
        const q: QuestionData = {
          id: message.questionId!,
          text: message.text!,
          orderIndex: message.questionIndex!,
          totalQuestions: message.totalQuestions!,
          timeLimitSeconds: message.timeLimitSeconds!,
          options: message.options!,
        };
        setSessionState("ACTIVE");
        setQuestion(q);
        setSelectedOptionIds([]);
        setCorrectOptionId(null);
        startTimer(q.timeLimitSeconds);
      }

      if (message.event === "QUESTION_END") {
        setCorrectOptionId(message.correctOptionId!);
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(0);
      }

      if (message.event === "SESSION_END") {
        router.replace(`/session/${sessionId}/results`);
      }

      if (message.event === "PARTICIPANT_JOINED") {
        setParticipantCount(message.count ?? 0);
      }
    });

    return () => {
      unsubscribe(dest);
    };
  }, [sessionId, subscribe, unsubscribe, router, startTimer]);

  const handleAnswer = useCallback(
    (optionId: number) => {
      if (correctOptionId !== null || !question || !rejoinToken) return;
      setSelectedOptionIds([optionId]);
      publish(`/app/session/${sessionId}/answer`, {
        rejoinToken,
        questionId: question.id,
        selectedOptionIds: [optionId],
      });
    },
    [correctOptionId, question, rejoinToken, publish, sessionId],
  );

  const getOptionState = (optionId: number) => {
    if (correctOptionId !== null) {
      if (optionId === correctOptionId) return "correct";
      if (selectedOptionIds.includes(optionId)) return "wrong";
      return "neutral";
    }
    if (selectedOptionIds.length > 0) {
      if (selectedOptionIds.includes(optionId)) return "selected";
      return "faded";
    }
    return "idle";
  };

  if (sessionState === "LOBBY") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center px-6"
        >
          <p className="label mb-6">{sessionName || "Live Session"}</p>

          <div className="mb-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={participantCount}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="font-bold text-foreground tabular-nums"
                style={{ fontSize: "clamp(3rem, 10vw, 5rem)", lineHeight: 1 }}
              >
                {participantCount}
              </motion.div>
            </AnimatePresence>
            <p className="label mt-3">
              {participantCount === 1 ? "Participant" : "Participants"} joined
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 text-muted">
            <span
              aria-hidden
              className="live-dot inline-block w-2 h-2 rounded-full bg-success"
            />
            <p className="text-sm tracking-wide">Waiting for host to start…</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (sessionState === "ACTIVE" && question) {
    return (
      <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <p className="label tabular-nums">
              Question {question.orderIndex} of {question.totalQuestions}
            </p>
            <div
              className="font-bold tabular-nums transition-all duration-300"
              style={{
                fontSize:
                  timeLeft !== null && timeLeft <= 5 ? "1.5rem" : "1rem",
                color:
                  timeLeft !== null && timeLeft <= 5
                    ? "var(--color-danger)"
                    : timeLeft !== null && timeLeft <= 10
                      ? "var(--color-warning)"
                      : "var(--color-foreground)",
                textShadow:
                  timeLeft !== null && timeLeft <= 5
                    ? `0 0 12px rgba(${colorRgb.danger},0.6)`
                    : "none",
              }}
            >
              {timeLeft ?? "—"}s
            </div>
          </div>
        </div>

        {/* Question + options */}
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col px-6 py-8 max-w-2xl mx-auto w-full"
          >
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground text-center mb-8 leading-snug">
              {question.text}
            </h1>

            {/* Options 2×2 grid */}
            <div className="grid grid-cols-2 gap-2 flex-1">
              {question.options
                .toSorted((a, b) => a.orderIndex - b.orderIndex)
                .map((opt, i) => {
                  const meta = OPTION_META[i % OPTION_META.length];
                  const state = getOptionState(opt.id);

                  // Dormant: pure neutral. Color only appears on selection.
                  let bgStyle = "var(--color-surface)";
                  let borderStyle = "var(--color-border)";
                  let letterColor = "var(--color-muted-dark)";
                  let opacity = 1;

                  if (state === "selected") {
                    bgStyle = `rgba(${meta.rgb}, 0.16)`;
                    borderStyle = meta.color;
                    letterColor = meta.color;
                  } else if (state === "faded") {
                    opacity = 0.3;
                  } else if (state === "correct") {
                    bgStyle = `rgba(${colorRgb.success},0.16)`;
                    borderStyle = `rgba(${colorRgb.success},0.7)`;
                    letterColor = "var(--color-success)";
                  } else if (state === "wrong") {
                    bgStyle = `rgba(${colorRgb.danger},0.08)`;
                    borderStyle = `rgba(${colorRgb.danger},0.25)`;
                    letterColor = "var(--color-danger)";
                    opacity = 0.5;
                  } else if (state === "neutral" && correctOptionId !== null) {
                    opacity = 0.18;
                  }

                  const isInteractive = correctOptionId === null;

                  return (
                    <motion.button
                      key={opt.id}
                      onClick={() => handleAnswer(opt.id)}
                      disabled={!isInteractive}
                      whileHover={isInteractive ? { scale: 1.015 } : {}}
                      whileTap={isInteractive ? { scale: 0.97 } : {}}
                      animate={{
                        opacity,
                        background: bgStyle,
                        borderColor: borderStyle,
                      }}
                      transition={{ duration: 0.2 }}
                      className="relative flex flex-col justify-between p-5 text-left border cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      style={{ minHeight: 108 }}
                    >
                      {/* Top row: letter + result indicator */}
                      <div className="flex items-center justify-between mb-3">
                        <motion.span
                          animate={{ color: letterColor }}
                          transition={{ duration: 0.2 }}
                          className="font-mono font-black text-xs tracking-widest"
                          aria-hidden
                        >
                          {meta.letter}
                        </motion.span>
                        {state === "correct" && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-success text-sm font-bold"
                          >
                            ✓
                          </motion.span>
                        )}
                        {state === "wrong" && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-danger text-sm"
                          >
                            ✗
                          </motion.span>
                        )}
                      </div>
                      {/* Option text */}
                      <p className="text-base md:text-lg lg:text-xl font-medium text-foreground leading-snug">
                        {opt.text}
                      </p>
                    </motion.button>
                  );
                })}
            </div>

            {/* Status message */}
            <div aria-live="polite" aria-atomic="true" className="mt-6 min-h-6">
              <AnimatePresence>
                {selectedOptionIds.length > 0 && correctOptionId === null && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    role="status"
                    className="text-center label text-success"
                  >
                    Answer recorded
                  </motion.p>
                )}
                {!selectedOptionIds.length &&
                  correctOptionId === null &&
                  timeLeft === 0 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      role="status"
                      className="text-center label"
                    >
                      Time&apos;s up
                    </motion.p>
                  )}
                {correctOptionId !== null && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                    aria-live="assertive"
                    className="text-center label"
                    style={{
                      color:
                        selectedOptionIds.includes(correctOptionId ?? -1)
                          ? "var(--color-success)"
                          : "var(--color-danger)",
                    }}
                  >
                    {selectedOptionIds.includes(correctOptionId ?? -1)
                      ? "Correct!"
                      : "Incorrect"}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Spinner />
    </div>
  );
}
