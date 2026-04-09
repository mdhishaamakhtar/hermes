"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import useSWR from "swr";
import {
  passagesApi,
  questionsApi,
  quizzesApi,
  sessionsApi,
} from "@/lib/apiClient";
import { QuizEditorSkeleton } from "@/components/PageSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import BackLink from "@/components/ui/BackLink";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import PassageCard from "@/components/quizzes/PassageCard";
import PassageForm from "@/components/quizzes/PassageForm";
import QuestionCard from "@/components/quizzes/QuestionCard";
import QuestionForm from "@/components/quizzes/QuestionForm";
import SessionList from "@/components/quizzes/SessionList";
import type { DisplayMode, Passage, Question, Quiz, SessionItem } from "@/lib/types";
import { DISPLAY_MODE_OPTIONS } from "@/components/quizzes/editor-model";

type ComposerMode = "question" | "passage" | null;

type CanvasItem =
  | { kind: "question"; orderIndex: number; question: Question }
  | { kind: "passage"; orderIndex: number; passage: Passage };

function sortQuestions(questions: Question[]): Question[] {
  return questions.toSorted((a, b) => a.orderIndex - b.orderIndex);
}

function sortPassages(passages: Passage[]): Passage[] {
  return passages.toSorted((a, b) => a.orderIndex - b.orderIndex);
}

function sortCanvasItems(items: CanvasItem[]): CanvasItem[] {
  return items.toSorted((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }

    if (a.kind === b.kind) return 0;
    return a.kind === "question" ? -1 : 1;
  });
}

function withQuestionUpdated(quiz: Quiz, updated: Question): Quiz {
  if (updated.passageId == null) {
    return {
      ...quiz,
      questions: sortQuestions(
        quiz.questions.map((question) =>
          question.id === updated.id ? updated : question,
        ),
      ),
    };
  }

  return {
    ...quiz,
    passages: sortPassages(
      quiz.passages.map((passage) =>
        passage.id === updated.passageId
          ? {
              ...passage,
              subQuestions: sortQuestions(
                passage.subQuestions.map((question) =>
                  question.id === updated.id ? updated : question,
                ),
              ),
            }
          : passage,
      ),
    ),
  };
}

function withQuestionRemoved(quiz: Quiz, questionId: number): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.filter((question) => question.id !== questionId),
    passages: quiz.passages.map((passage) => ({
      ...passage,
      subQuestions: passage.subQuestions.filter(
        (question) => question.id !== questionId,
      ),
    })),
  };
}

function nextOrderIndexForQuiz(quiz: Quiz): number {
  const highestStandalone = quiz.questions.reduce(
    (max, question) => Math.max(max, question.orderIndex),
    0,
  );
  const highestPassage = quiz.passages.reduce(
    (max, passage) => Math.max(max, passage.orderIndex),
    0,
  );

  return Math.max(highestStandalone, highestPassage) + 1;
}

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

  const [composerMode, setComposerMode] = useState<ComposerMode>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [abandoning, setAbandoning] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [confirmLabel, setConfirmLabel] = useState("Confirm");
  const [confirmVariant, setConfirmVariant] = useState<"warning" | "danger">(
    "warning",
  );
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(
    null,
  );
  const [quizDisplayModeDraft, setQuizDisplayModeDraft] =
    useState<DisplayMode>("BLIND");
  const [savingQuizSettings, setSavingQuizSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (quizError) router.push(`/events/${eventId}`);
  }, [quizError, eventId, router]);

  useEffect(() => {
    if (quiz) {
      setQuizDisplayModeDraft(quiz.displayMode);
    }
  }, [quiz]);

  if (quizLoading || !quiz) return <QuizEditorSkeleton />;

  const standaloneQuestions = sortQuestions(
    quiz.questions.filter((question) => question.passageId == null),
  );
  const passages = sortPassages(quiz.passages);
  const canvasItems = sortCanvasItems([
    ...standaloneQuestions.map((question) => ({
      kind: "question" as const,
      orderIndex: question.orderIndex,
      question,
    })),
    ...passages.map((passage) => ({
      kind: "passage" as const,
      orderIndex: passage.orderIndex,
      passage,
    })),
  ]);
  const totalPrompts =
    standaloneQuestions.length +
    passages.reduce((count, passage) => count + passage.subQuestions.length, 0);
  const nextOrderIndex = nextOrderIndexForQuiz(quiz);
  const hasBlockingSession = sessions.some(
    (session) => session.status === "LOBBY" || session.status === "ACTIVE",
  );

  const closeComposer = () => setComposerMode(null);

  const handleQuestionAdded = (question: Question) => {
    mutateQuiz(
      {
        ...quiz,
        questions: sortQuestions([...quiz.questions, question]),
      },
      { revalidate: false },
    );
    closeComposer();
  };

  const handlePassageAdded = (passage: Passage) => {
    mutateQuiz(
      {
        ...quiz,
        passages: sortPassages([...quiz.passages, passage]),
      },
      { revalidate: false },
    );
    closeComposer();
  };

  const handleQuestionSaved = (updated: Question) => {
    mutateQuiz(withQuestionUpdated(quiz, updated), { revalidate: false });
  };

  const handlePassageSaved = (updated: Passage) => {
    mutateQuiz(
      {
        ...quiz,
        passages: sortPassages(
          quiz.passages.map((passage) =>
            passage.id === updated.id ? updated : passage,
          ),
        ),
      },
      { revalidate: false },
    );
  };

  const handleSubQuestionAdded = (passageId: number, question: Question) => {
    mutateQuiz(
      {
        ...quiz,
        passages: sortPassages(
          quiz.passages.map((passage) =>
            passage.id === passageId
              ? {
                  ...passage,
                  subQuestions: sortQuestions([
                    ...passage.subQuestions,
                    question,
                  ]),
                }
              : passage,
          ),
        ),
      },
      { revalidate: false },
    );
  };

  const requestDeleteQuestion = (questionId: number) => {
    setConfirmMessage("Delete this question? This cannot be undone.");
    setConfirmLabel("Delete");
    setConfirmVariant("danger");
    setConfirmAction(() => async () => {
      setConfirmMessage(null);
      const response = await questionsApi.delete(questionId);

      if (response.success) {
        mutateQuiz(withQuestionRemoved(quiz, questionId), {
          revalidate: false,
        });
      }
    });
  };

  const requestDeletePassage = (passageId: number) => {
    setConfirmMessage(
      "Delete this passage and every nested sub-question? This cannot be undone.",
    );
    setConfirmLabel("Delete");
    setConfirmVariant("danger");
    setConfirmAction(() => async () => {
      setConfirmMessage(null);
      const response = await passagesApi.delete(passageId);

      if (response.success) {
        mutateQuiz(
          {
            ...quiz,
            passages: quiz.passages.filter((passage) => passage.id !== passageId),
          },
          { revalidate: false },
        );
      }
    });
  };

  const handleSaveQuizSettings = async () => {
    setSavingQuizSettings(true);
    setSettingsError(null);

    const response = await quizzesApi.update(quizId, {
      title: quiz.title,
      orderIndex: quiz.orderIndex,
      displayMode: quizDisplayModeDraft,
    });

    if (response.success) {
      mutateQuiz(
        {
          ...quiz,
          displayMode: quizDisplayModeDraft,
        },
        { revalidate: false },
      );
    } else {
      setSettingsError(
        response.error?.message ?? "Failed to save quiz display settings.",
      );
    }

    setSavingQuizSettings(false);
  };

  const handleLaunch = async () => {
    setLaunching(true);
    setLaunchError(null);
    const response = await sessionsApi.create(Number(quizId));

    if (response.success) {
      localStorage.setItem(
        `hermes_session_${response.data.id}`,
        response.data.joinCode,
      );
      router.refresh();
      router.push(`/session/${response.data.id}/host`);
      return;
    }

    setLaunchError(response.error?.message ?? "Failed to create session");
    setLaunching(false);
  };

  const handleAbandon = (sessionId: number) => {
    setConfirmMessage(
      "Abandon this session? The quiz will become editable again.",
    );
    setConfirmLabel("Abandon");
    setConfirmVariant("warning");
    setConfirmAction(() => async () => {
      setConfirmMessage(null);
      setAbandoning(true);
      const response = await sessionsApi.end(sessionId);
      if (response.success) {
        mutateSessions(
          sessions.map((session) =>
            session.id === sessionId
              ? { ...session, status: "ENDED" }
              : session,
          ),
          { revalidate: false },
        );
      }
      setAbandoning(false);
    });
  };

  const handleAbandonAll = () => {
    const lobbyIds = sessions
      .filter((session) => session.status === "LOBBY")
      .map((session) => session.id);
    if (!lobbyIds.length) return;

    setConfirmMessage(
      `Abandon all ${lobbyIds.length} lobby session(s)? The quiz will become editable again.`,
    );
    setConfirmLabel("Abandon");
    setConfirmVariant("warning");
    setConfirmAction(() => async () => {
      setConfirmMessage(null);
      setAbandoning(true);
      await Promise.all(lobbyIds.map((id) => sessionsApi.end(id)));
      mutateSessions(
        sessions.map((session) =>
          lobbyIds.includes(session.id)
            ? { ...session, status: "ENDED" }
            : session,
        ),
        { revalidate: false },
      );
      setAbandoning(false);
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <BackLink href={`/events/${eventId}`} label="Event" />

      <PageHeader
        label="Quiz Editor"
        title={quiz.title}
        description="Build a stage-ready sequence with standalone prompts and timed passage blocks."
        meta={
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="border border-border px-3 py-2 font-mono uppercase tracking-[0.12em]">
              {canvasItems.length} blocks
            </span>
            <span className="border border-border px-3 py-2 font-mono uppercase tracking-[0.12em]">
              {totalPrompts} prompts
            </span>
            <span className="border border-border px-3 py-2 font-mono uppercase tracking-[0.12em]">
              Default {quiz.displayMode.toLowerCase()}
            </span>
          </div>
        }
        action={
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleLaunch}
              disabled={launching || totalPrompts === 0}
              className="bg-primary px-6 py-3 text-sm tracking-widest text-white uppercase transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {launching ? "Launching..." : "↑ Launch Session"}
            </button>
            {launchError ? (
              <p className="text-xs text-danger">{launchError}</p>
            ) : null}
          </div>
        }
      />

      <section className="mb-8 border border-border bg-surface">
        <div className="grid gap-5 px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:px-6 md:py-6">
          <div>
            <p className="label text-accent">Stage Defaults</p>
            <p className="mt-2 max-w-[58ch] text-sm text-muted">
              Set the default reveal behavior once. Individual questions can
              still override it when the round needs a different stage treatment.
            </p>
          </div>

          <div className="grid gap-3 md:min-w-[18rem]">
            <label className="block">
              <span className="field-label mb-2 block">Quiz Display Mode</span>
              <select
                value={quizDisplayModeDraft}
                onChange={(event) =>
                  setQuizDisplayModeDraft(event.target.value as DisplayMode)
                }
                disabled={hasBlockingSession}
                className="input-field"
              >
                {DISPLAY_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleSaveQuizSettings}
              disabled={
                hasBlockingSession ||
                savingQuizSettings ||
                quizDisplayModeDraft === quiz.displayMode
              }
              className="btn-primary px-5 py-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingQuizSettings ? "Saving..." : "Save Defaults"}
            </button>
            {settingsError ? (
              <p className="text-sm text-danger">{settingsError}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mb-6 border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4 md:px-6">
          <div>
            <p className="label text-foreground/75">Canvas</p>
            <p className="mt-1 text-sm text-muted">
              Order the round as standalone prompts or grouped reading blocks.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setComposerMode((current) =>
                  current === "question" ? null : "question",
                )
              }
              disabled={hasBlockingSession}
              className="label border border-border px-3 py-2 text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
            >
              {composerMode === "question" ? "Close Question Composer" : "+ Standalone Question"}
            </button>
            <button
              type="button"
              onClick={() =>
                setComposerMode((current) =>
                  current === "passage" ? null : "passage",
                )
              }
              disabled={hasBlockingSession}
              className="label border border-border px-3 py-2 text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
            >
              {composerMode === "passage" ? "Close Passage Composer" : "+ Passage Block"}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {composerMode === "question" ? (
            <QuestionForm
              quizId={quizId}
              nextOrderIndex={nextOrderIndex}
              quizDisplayMode={quiz.displayMode}
              onAdded={handleQuestionAdded}
              onCancel={closeComposer}
            />
          ) : null}

          {composerMode === "passage" ? (
            <PassageForm
              quizId={quizId}
              nextOrderIndex={nextOrderIndex}
              onAdded={handlePassageAdded}
              onCancel={closeComposer}
            />
          ) : null}
        </AnimatePresence>
      </section>

      {canvasItems.length === 0 ? (
        <EmptyState message="No prompts yet. Add a standalone question or a passage block above." />
      ) : (
        <div className="mb-12 space-y-4">
          {canvasItems.map((item, index) =>
            item.kind === "question" ? (
              <QuestionCard
                key={`question-${item.question.id}`}
                question={item.question}
                index={index}
                disabled={hasBlockingSession}
                onDelete={requestDeleteQuestion}
                onSaved={handleQuestionSaved}
                onEditOpen={closeComposer}
              />
            ) : (
              <PassageCard
                key={`passage-${item.passage.id}`}
                passage={item.passage}
                disabled={hasBlockingSession}
                onDelete={requestDeletePassage}
                onSaved={handlePassageSaved}
                onSubQuestionAdded={handleSubQuestionAdded}
                onSubQuestionSaved={handleQuestionSaved}
                onSubQuestionDeleted={requestDeleteQuestion}
                onEditOpen={closeComposer}
              />
            ),
          )}
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
        variant={confirmVariant}
        onConfirm={() => {
          void confirmAction?.();
        }}
        onCancel={() => setConfirmMessage(null)}
      />
    </div>
  );
}
