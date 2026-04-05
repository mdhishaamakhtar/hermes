"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import useSWR from "swr";
import { sessionsApi } from "@/lib/apiClient";
import { QuizEditorSkeleton } from "@/components/PageSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import QuestionCard from "@/components/quizzes/QuestionCard";
import QuestionForm from "@/components/quizzes/QuestionForm";
import SessionList from "@/components/quizzes/SessionList";
import type { Quiz, Question, SessionItem } from "@/lib/types";

export default function QuizEditorClient({
  eventId,
  quizId,
}: {
  eventId: string;
  quizId: string;
}) {
  const router = useRouter();
  const {
    data: quiz,
    mutate: mutateQuiz,
    isLoading: quizLoading,
    error: quizError,
  } = useSWR<Quiz>(`/api/quizzes/${quizId}`);
  const { data: sessions = [], mutate: mutateSessions } = useSWR<SessionItem[]>(
    `/api/quizzes/${quizId}/sessions`,
  );

  const [showForm, setShowForm] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [abandoning, setAbandoning] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [confirmLabel, setConfirmLabel] = useState("Confirm");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (quizError) router.push(`/events/${eventId}`);
  }, [quizError, eventId, router]);

  const questions = useMemo(
    () =>
      (quiz?.questions ?? []).toSorted((a, b) => a.orderIndex - b.orderIndex),
    [quiz?.questions],
  );

  const hasBlockingSession = sessions.some(
    (s) => s.status === "LOBBY" || s.status === "ACTIVE",
  );

  const handleQuestionAdded = (question: Question) => {
    if (!quiz) return;
    mutateQuiz(
      {
        ...quiz,
        questions: [...quiz.questions, question].toSorted(
          (a, b) => a.orderIndex - b.orderIndex,
        ),
      },
      { revalidate: false },
    );
    setShowForm(false);
  };

  const handleQuestionSaved = (updated: Question) => {
    if (!quiz) return;
    mutateQuiz(
      {
        ...quiz,
        questions: quiz.questions.map((q) =>
          q.id === updated.id ? updated : q,
        ),
      },
      { revalidate: false },
    );
  };

  const handleQuestionDeleted = (questionId: number) => {
    setConfirmMessage("Delete this question? This cannot be undone.");
    setConfirmLabel("Delete");
    setConfirmAction(() => async () => {
      setConfirmMessage(null);
      const { questionsApi } = await import("@/lib/apiClient");
      const res = await questionsApi.delete(questionId);
      if (res.success && quiz) {
        mutateQuiz(
          {
            ...quiz,
            questions: quiz.questions.filter((q) => q.id !== questionId),
          },
          { revalidate: false },
        );
      }
    });
  };

  const handleLaunch = async () => {
    setLaunching(true);
    setLaunchError(null);
    const res = await sessionsApi.create(Number(quizId));

    if (res.success) {
      localStorage.setItem(`hermes_session_${res.data.id}`, res.data.joinCode);
      router.refresh();
      router.push(`/session/${res.data.id}/host`);
      return;
    }

    setLaunchError(res.error?.message ?? "Failed to create session");
    setLaunching(false);
  };

  const handleAbandon = (sessionId: number) => {
    setConfirmMessage(
      "Abandon this session? The quiz will become editable again.",
    );
    setConfirmLabel("Abandon");
    setConfirmAction(() => async () => {
      setConfirmMessage(null);
      setAbandoning(true);
      const res = await sessionsApi.end(sessionId);
      if (res.success) {
        mutateSessions(
          sessions.map((s) =>
            s.id === sessionId ? { ...s, status: "ENDED" } : s,
          ),
          { revalidate: false },
        );
      }
      setAbandoning(false);
    });
  };

  const handleAbandonAll = () => {
    const lobbyIds = sessions
      .filter((s) => s.status === "LOBBY")
      .map((s) => s.id);
    if (!lobbyIds.length) return;

    setConfirmMessage(
      `Abandon all ${lobbyIds.length} lobby session(s)? The quiz will become editable again.`,
    );
    setConfirmLabel("Abandon");
    setConfirmAction(() => async () => {
      setConfirmMessage(null);
      setAbandoning(true);
      await Promise.all(lobbyIds.map((id) => sessionsApi.end(id)));
      mutateSessions(
        sessions.map((s) =>
          lobbyIds.includes(s.id) ? { ...s, status: "ENDED" } : s,
        ),
        { revalidate: false },
      );
      setAbandoning(false);
    });
  };

  if (quizLoading || !quiz) return <QuizEditorSkeleton />;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-2">
        <Link
          href={`/events/${eventId}`}
          prefetch
          className="label hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ← Event
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-start justify-between mb-10"
      >
        <div>
          <p className="label mb-1">Quiz Editor</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
            {quiz.title}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleLaunch}
            disabled={launching || questions.length === 0}
            className="bg-primary text-white px-6 py-3 text-sm tracking-widest uppercase hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {launching ? "Launching..." : "↑ Launch Session"}
          </button>
          {launchError && <p className="text-xs text-danger">{launchError}</p>}
        </div>
      </motion.div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="label">Questions ({questions.length})</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          disabled={hasBlockingSession}
          className="text-sm tracking-widest uppercase text-accent hover:text-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {showForm ? "Cancel" : "+ Add Question"}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <QuestionForm
            quizId={quizId}
            nextOrderIndex={questions.length + 1}
            onAdded={handleQuestionAdded}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      <div className="h-px bg-border mb-4" />

      {questions.length === 0 ? (
        <p className="text-center py-16 text-muted text-sm">
          No questions yet. Add one above.
        </p>
      ) : (
        <div className="space-y-2 mb-12">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={index}
              disabled={hasBlockingSession}
              onDelete={handleQuestionDeleted}
              onSaved={handleQuestionSaved}
              onEditOpen={() => setShowForm(false)}
            />
          ))}
        </div>
      )}

      <SessionList
        sessions={sessions}
        abandoning={abandoning}
        onAbandon={handleAbandon}
        onAbandonAll={handleAbandonAll}
      />

      <ConfirmDialog
        message={confirmMessage}
        confirmLabel={confirmLabel}
        onConfirm={() => confirmAction?.()}
        onCancel={() => setConfirmMessage(null)}
      />
    </div>
  );
}
