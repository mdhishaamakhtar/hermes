"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useStompClient } from "@/hooks/useStompClient";
import Logo from "@/components/Logo";
import { OPTION_META } from "@/lib/session-constants";
import { colorRgb } from "@/lib/design-tokens";

interface Option {
  id: number;
  text: string;
}
interface QuestionMsg {
  event: string;
  questionId: number;
  text: string;
  options: Option[];
  timeLimitSeconds: number;
  questionIndex: number;
  totalQuestions: number;
}
interface AnswerUpdate {
  event: string;
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
}
interface LeaderboardEntry {
  rank: number;
  participantId: number;
  displayName: string;
  score: number;
}
interface LeaderboardUpdate {
  event: string;
  leaderboard: LeaderboardEntry[];
}
interface SessionEnd {
  event: string;
  leaderboard?: LeaderboardEntry[];
  totalParticipants?: number;
}
interface ParticipantJoined {
  event: "PARTICIPANT_JOINED";
  count: number;
}

export default function HostPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [sessionStatus, setSessionStatus] = useState<
    "LOBBY" | "ACTIVE" | "ENDED"
  >("LOBBY");
  const [joinCode, setJoinCode] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(`hermes_session_${id}`) || "";
  });
  const [participantCount, setParticipantCount] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionMsg | null>(
    null,
  );
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [finalLeaderboard, setFinalLeaderboard] = useState<
    LeaderboardEntry[] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const authToken =
    token ||
    (typeof window !== "undefined" ? localStorage.getItem("hermes_token") : "");

  const { subscribe } = useStompClient({
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    onConnect: () => {
      subscribe(`/topic/session.${id}.question`, (msg) => {
        const data = msg as QuestionMsg | { event: string };
        if (data.event === "QUESTION_START") {
          const q = data as QuestionMsg;
          setCurrentQuestion(q);
          setTimeLeft(q.timeLimitSeconds);
          setCounts({});
          setTotalAnswered(0);
        } else if (data.event === "SESSION_END") {
          setSessionStatus("ENDED");
        }
      });
      subscribe(`/topic/session.${id}.analytics`, (msg) => {
        const data = msg as AnswerUpdate | LeaderboardUpdate | SessionEnd;
        if (data.event === "ANSWER_UPDATE") {
          const a = data as AnswerUpdate;
          setCounts(a.counts);
          setTotalAnswered(a.totalAnswered);
        } else if (data.event === "LEADERBOARD_UPDATE") {
          setLeaderboard((data as LeaderboardUpdate).leaderboard);
        } else if (data.event === "SESSION_END") {
          const se = data as SessionEnd;
          setFinalLeaderboard(se.leaderboard || []);
          setSessionStatus("ENDED");
        }
      });
      subscribe(`/topic/session.${id}.control`, (msg) => {
        const data = msg as ParticipantJoined;
        if (data.event === "PARTICIPANT_JOINED")
          setParticipantCount(data.count);
      });
    },
  });

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  // On mount: fetch lobby state (count + joinCode) and check if already ENDED
  useEffect(() => {
    if (!user || !id) return;
    api
      .get<{ status: string; participantCount: number; joinCode: string }>(
        `/api/sessions/${id}/lobby`,
      )
      .then((res) => {
        if (!res.success) return;
        const { status, participantCount: count, joinCode: code } = res.data;
        setParticipantCount(count);
        if (code) setJoinCode(code);
        if (status === "ENDED") {
          router.replace(`/session/${id}/review`);
        } else if (status === "ACTIVE") {
          setSessionStatus("ACTIVE");
        }
      })
      .catch(() => {});
  }, [id, user, router]);

  // Timer countdown
  useEffect(() => {
    if (sessionStatus !== "ACTIVE" || timeLeft <= 0) return;
    const interval = setInterval(
      () => setTimeLeft((t) => Math.max(0, t - 1)),
      1000,
    );
    return () => clearInterval(interval);
  }, [sessionStatus, timeLeft, currentQuestion]);

  const handleStart = async () => {
    setLoading(true);
    await api.post(`/api/sessions/${id}/start`);
    setSessionStatus("ACTIVE");
    setLoading(false);
  };

  const handleNext = async () => {
    setLoading(true);
    await api.post(`/api/sessions/${id}/next`);
    setLoading(false);
  };

  const handleEnd = async () => {
    setLoading(true);
    await api.post(`/api/sessions/${id}/end`);
    setSessionStatus("ENDED");
    setLoading(false);
  };

  const handleCopyCode = useCallback(() => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [joinCode]);

  const timerColor =
    timeLeft <= 5
      ? "var(--color-danger)"
      : timeLeft <= 10
        ? "var(--color-warning)"
        : "var(--color-foreground)";
  const timerPct = currentQuestion
    ? (timeLeft / currentQuestion.timeLimitSeconds) * 100
    : 0;

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 border border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="scanlines min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between relative z-10 shrink-0">
        <Logo size="sm" />
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background:
                  sessionStatus === "ACTIVE"
                    ? "var(--color-success)"
                    : sessionStatus === "ENDED"
                      ? "var(--color-muted)"
                      : "var(--color-warning)",
                animation:
                  sessionStatus === "ACTIVE"
                    ? "pulse-dot var(--duration-slow) ease-in-out infinite"
                    : "none",
              }}
            />
            <span
              className={`text-xs tracking-widest uppercase ${
                sessionStatus === "ACTIVE"
                  ? "text-success"
                  : sessionStatus === "ENDED"
                    ? "text-muted"
                    : "text-warning"
              }`}
            >
              {sessionStatus}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* ── LOBBY ─────────────────────────────────────────────────────────── */}
        {sessionStatus === "LOBBY" && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
            {/* Join code hero */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-center mb-10"
            >
              <p className="label tracking-[0.25em] mb-6">Share this code</p>

              <div
                className="font-black text-center text-foreground select-all px-8 py-5 border border-primary/30 bg-surface"
                style={{
                  fontSize: "clamp(2rem, 5vw, 3rem)",
                  letterSpacing: "0.35em",
                  paddingLeft: "calc(2rem + 0.35em)",
                }}
              >
                {joinCode || "——————"}
              </div>

              {/* Copy button */}
              <div className="mt-4" aria-live="polite">
                <button
                  onClick={handleCopyCode}
                  disabled={!joinCode}
                  aria-label={
                    copied ? "Join code copied to clipboard" : "Copy join code"
                  }
                  className={`text-xs tracking-widest uppercase transition-all px-4 py-2 border disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    copied
                      ? "text-success border-success/25 bg-success/5"
                      : "text-muted border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {copied ? "✓ Copied!" : "Copy Code"}
                </button>
              </div>
            </motion.div>

            {/* Participant count */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.08 }}
              className="text-center mb-10"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={participantCount}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2 }}
                  className="font-black tabular-nums text-foreground"
                  style={{
                    fontSize: "clamp(2.5rem, 7vw, 4rem)",
                    lineHeight: 1,
                  }}
                >
                  {participantCount}
                </motion.div>
              </AnimatePresence>
              <p className="text-sm text-muted mt-1 tracking-wide">
                {participantCount === 1 ? "participant" : "participants"} joined
              </p>
            </motion.div>

            {/* Start CTA */}
            <motion.button
              onClick={handleStart}
              disabled={loading}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.14 }}
              whileTap={!loading ? { scale: 0.97 } : {}}
              className="bg-primary text-white px-14 py-4 text-sm tracking-widest uppercase font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {loading ? "Starting..." : "Start Session"}
            </motion.button>
          </div>
        )}

        {/* ── ACTIVE ────────────────────────────────────────────────────────── */}
        {sessionStatus === "ACTIVE" && currentQuestion && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar: question text + index */}
            <div className="border-b border-border px-8 py-5 bg-background">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center gap-3 mb-2">
                  <span className="label tabular-nums">
                    Q{currentQuestion.questionIndex} /{" "}
                    {currentQuestion.totalQuestions}
                  </span>
                  {/* Timer inline top-right */}
                  <div className="ml-auto flex items-center gap-3">
                    <span
                      className="font-black tabular-nums transition-all duration-300"
                      style={{
                        fontSize: timeLeft <= 10 ? "2rem" : "1.5rem",
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                        color: timerColor,
                        textShadow:
                          timeLeft <= 5
                            ? `0 0 16px rgba(${colorRgb.danger},0.5)`
                            : "none",
                      }}
                    >
                      {timeLeft}s
                    </span>
                  </div>
                </div>
                {/* Timer bar */}
                <div className="h-0.5 bg-border overflow-hidden mb-3 relative">
                  <motion.div
                    className="h-full absolute inset-0 origin-left"
                    animate={{ scaleX: timerPct / 100 }}
                    transition={{ duration: 0.5 }}
                    style={{
                      backgroundColor: timerColor,
                      willChange: "transform",
                    }}
                  />
                </div>
                <h2 className="text-2xl font-bold text-foreground leading-snug">
                  {currentQuestion.text}
                </h2>
              </div>
            </div>

            {/* Bottom split: responses + leaderboard */}
            <div className="flex-1 grid grid-cols-[3fr_2fr] divide-x divide-border overflow-hidden">
              {/* Left: Response bars */}
              <div className="p-8 flex flex-col overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                  <span className="label">Responses</span>
                  <span className="text-xs tabular-nums text-muted">
                    {totalAnswered} / {participantCount}
                  </span>
                </div>
                <div className="space-y-5 flex-1">
                  {currentQuestion.options.map((opt, i) => {
                    const count = counts[opt.id] ?? 0;
                    const maxVal = Math.max(1, ...Object.values(counts));
                    const pct = (count / maxVal) * 100;
                    const meta = OPTION_META[i % 4];
                    return (
                      <div key={opt.id}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-foreground font-medium truncate pr-4 max-w-[80%]">
                            {opt.text}
                          </span>
                          <span
                            className="text-sm tabular-nums font-bold shrink-0"
                            style={{ color: meta.color }}
                          >
                            {count}
                          </span>
                        </div>
                        <div className="h-3 bg-surface overflow-hidden rounded-sm relative">
                          <motion.div
                            className="h-full rounded-sm absolute inset-0 origin-left"
                            animate={{ scaleX: pct / 100 }}
                            transition={{
                              type: "spring",
                              stiffness: 200,
                              damping: 25,
                            }}
                            style={{
                              backgroundColor: meta.color,
                              willChange: "transform",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Live leaderboard */}
              <div className="p-8 flex flex-col overflow-hidden">
                <span className="label mb-5">Leaderboard</span>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  <AnimatePresence>
                    {leaderboard.slice(0, 10).map((entry) => (
                      <motion.div
                        key={entry.participantId}
                        layout
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-between px-3 py-2.5 border border-border bg-surface"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="text-xs tabular-nums w-5 shrink-0 font-bold"
                            style={{
                              color:
                                entry.rank <= 3
                                  ? "var(--color-warning)"
                                  : "var(--color-muted-dark)",
                            }}
                          >
                            {entry.rank}
                          </span>
                          <span className="text-sm text-foreground truncate">
                            {entry.displayName}
                          </span>
                        </div>
                        <span className="text-sm tabular-nums text-success font-bold shrink-0 ml-2">
                          {entry.score}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {leaderboard.length === 0 && (
                    <p
                      aria-live="polite"
                      className="text-xs text-muted/50 text-center pt-8"
                    >
                      No answers yet
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Fixed bottom controls */}
            <div className="border-t border-border px-8 py-4 flex items-center gap-3 bg-background shrink-0">
              <button
                onClick={handleNext}
                disabled={loading}
                className="bg-primary text-white px-8 py-2.5 text-xs tracking-widest uppercase hover:bg-primary-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin"
                      aria-hidden
                    />
                    Loading
                  </span>
                ) : currentQuestion.questionIndex ===
                  currentQuestion.totalQuestions ? (
                  "End Quiz"
                ) : (
                  <>
                    Next Question <span aria-hidden>→</span>
                  </>
                )}
              </button>
              <button
                onClick={handleEnd}
                disabled={loading}
                className="border border-border text-muted px-6 py-2.5 text-xs tracking-widest uppercase hover:border-danger/50 hover:text-danger disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Force End
              </button>
            </div>
          </div>
        )}

        {/* ── ENDED ─────────────────────────────────────────────────────────── */}
        {sessionStatus === "ENDED" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-center">
              <p className="label mb-4">Session Complete</p>
              <h2 className="text-3xl font-bold text-foreground leading-tight mb-8">
                Final Leaderboard
              </h2>
            </div>
            <div className="w-full max-w-sm space-y-2">
              {(finalLeaderboard || leaderboard).slice(0, 10).map((entry) => (
                <motion.div
                  key={entry.participantId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: entry.rank * 0.05 }}
                  className="flex items-center justify-between px-4 py-3 border border-border bg-surface"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="text-sm tabular-nums w-6 font-bold"
                      style={{
                        color:
                          entry.rank === 1
                            ? "var(--color-warning)"
                            : entry.rank <= 3
                              ? "var(--color-muted)"
                              : "var(--color-muted-dark)",
                      }}
                    >
                      {entry.rank}
                    </span>
                    <span className="text-foreground">{entry.displayName}</span>
                  </div>
                  <span className="tabular-nums text-success font-bold">
                    {entry.score}
                  </span>
                </motion.div>
              ))}
            </div>
            <button
              onClick={() => router.replace(`/session/${id}/review`)}
              className="border border-primary/50 text-accent px-8 py-3 text-xs tracking-widest uppercase hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Full Review →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
