"use client";

import { AnimatePresence } from "framer-motion";
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
import { useQuizEditor } from "@/components/quizzes/useQuizEditor";
import { DISPLAY_MODE_OPTIONS } from "@/components/quizzes/editor-model";
import type { DisplayMode, Passage, Question } from "@/lib/types";

type CanvasItem =
  | { kind: "question"; orderIndex: number; question: Question }
  | { kind: "passage"; orderIndex: number; passage: Passage };

function sortCanvasItems(items: CanvasItem[]): CanvasItem[] {
  return items.toSorted((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }

    if (a.kind === b.kind) return 0;
    return a.kind === "question" ? -1 : 1;
  });
}

export default function QuizEditorClient({
  eventId,
  quizId,
}: {
  eventId: string;
  quizId: string;
}) {
  const {
    quiz,
    quizLoading,
    sessions,
    composerMode,
    setComposerMode,
    launching,
    launchError,
    abandoning,
    confirmMessage,
    confirmLabel,
    confirmVariant,
    confirmAction,
    clearConfirm,
    quizDisplayModeDraft,
    setQuizDisplayModeDraft,
    savingQuizSettings,
    settingsError,
    closeComposer,
    handleQuestionAdded,
    handlePassageAdded,
    handleQuestionSaved,
    handlePassageSaved,
    handleSubQuestionAdded,
    requestDeleteQuestion,
    requestDeletePassage,
    handleSaveQuizSettings,
    handleLaunch,
    handleAbandon,
    handleAbandonAll,
    nextOrderIndexForQuiz,
    sortPassages,
    sortQuestions,
  } = useQuizEditor({ eventId, quizId });

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
              still override it when the round needs a different stage
              treatment.
            </p>
          </div>

          <div className="grid gap-3 md:min-w-[18rem]">
            <label className="block">
              <span className="field-label mb-2 block">Quiz Display Mode</span>
              <select
                value={quizDisplayModeDraft ?? quiz.displayMode}
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
                (quizDisplayModeDraft ?? quiz.displayMode) === quiz.displayMode
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
              {composerMode === "question"
                ? "Close Question Composer"
                : "+ Standalone Question"}
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
              {composerMode === "passage"
                ? "Close Passage Composer"
                : "+ Passage Block"}
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
        onCancel={clearConfirm}
      />
    </div>
  );
}
