"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { LoadError } from "@/components/LoadError";
import { Page, PageHeader, PageHeaderSkeleton } from "@/components/Page";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { describeError } from "@/lib/api";
import { countLabel } from "@/lib/format";
import { fade } from "@/lib/motion";
import type { DisplayMode, SessionSummary } from "@/lib/types";
import {
  DISPLAY_MODES,
  newQuestionDraft,
  questionCount,
  quizBlocks,
} from "./editor-model";
import { QuestionEditor } from "./QuestionEditor";
import {
  PassageBlock,
  PassageComposer,
  QuestionBlock,
  type BlockActions,
  type DeleteTarget,
} from "./QuizBlocks";
import { SessionList } from "./SessionList";
import { useQuizEditor } from "./useQuizEditor";

type Composer = "question" | "passage" | null;

export function QuizEditorClient({
  eventId,
  quizId,
}: {
  eventId: string;
  quizId: string;
}) {
  const router = useRouter();
  const editor = useQuizEditor(eventId, quizId);
  const { quiz, event, runningSession } = editor;
  const displayId = useId();

  const [composer, setComposer] = useState<Composer>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  // Targets are kept apart from the open flags so a dialog's copy does not
  // blank out while it animates closed.
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<SessionSummary | null>(
    null,
  );
  const [discardOpen, setDiscardOpen] = useState(false);

  if (!quiz) {
    return editor.error ? (
      <Page>
        <LoadError
          error={editor.error}
          resource="quiz"
          back={{ href: `/events/${eventId}`, label: "Back to the event" }}
          onRetry={editor.retry}
        />
      </Page>
    ) : (
      <QuizEditorSkeleton />
    );
  }

  const blocks = quizBlocks(quiz);
  const total = questionCount(quiz);
  const locked = Boolean(runningSession);

  // Running-order number of each block's first question.
  const starts: number[] = [];
  let next = 1;
  for (const block of blocks) {
    starts.push(next);
    next +=
      block.kind === "question"
        ? 1
        : Math.max(1, block.passage.subQuestions.length);
  }

  const actions: BlockActions = {
    quizDisplayMode: quiz.displayMode,
    locked,
    saveQuestion: editor.saveQuestion,
    savePassage: editor.savePassage,
    addSubQuestion: editor.addSubQuestion,
    requestDelete: (target) => {
      setDeleteTarget(target);
      setDeleteOpen(true);
    },
  };

  const launch = async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      router.push(`/session/${await editor.launch()}/host`);
    } catch (err) {
      setLaunchError(describeError(err, "Couldn't open a lobby."));
      setLaunching(false);
    }
  };

  const changeDisplayMode = async (mode: DisplayMode) => {
    try {
      await editor.setDisplayMode(mode);
    } catch (err) {
      toast.error(describeError(err, "Couldn't change the answer display."));
    }
  };

  return (
    <Page>
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Events" },
          { href: `/events/${eventId}`, label: event?.title ?? "Event" },
        ]}
        title={quiz.title}
        meta={
          <>
            <span>{countLabel(total, "question", "questions")}</span>
            {quiz.passages.length > 0 && (
              <span>
                {countLabel(quiz.passages.length, "passage", "passages")}
              </span>
            )}
          </>
        }
        actions={
          <Button
            variant="primary"
            size="lg"
            icon="play"
            onClick={launch}
            pending={launching}
            disabled={total === 0 || locked}
            title={total === 0 ? "Add a question first" : undefined}
          >
            {launching ? "Opening lobby…" : "Start a session"}
          </Button>
        }
      />

      {launchError && <Alert className="mb-8">{launchError}</Alert>}

      {runningSession && (
        <Alert
          tone="info"
          className="mb-8"
          action={
            <ButtonLink
              href={`/session/${runningSession.id}/host`}
              variant="primary"
              size="sm"
              trailingIcon="arrow-right"
            >
              Open host view
            </ButtonLink>
          }
        >
          A session of this quiz is{" "}
          {runningSession.status === "LOBBY"
            ? "waiting in the lobby"
            : "live right now"}
          . Editing is locked until it ends.
        </Alert>
      )}

      <section
        aria-label="Quiz settings"
        className="mb-12 border border-border bg-surface p-5 sm:p-6"
      >
        <Field id={displayId} label="Answer display during questions">
          <div className="max-w-md">
            <SegmentedControl<DisplayMode>
              id={displayId}
              value={quiz.displayMode}
              options={DISPLAY_MODES}
              onChange={changeDisplayMode}
              disabled={locked}
            />
          </div>
        </Field>
      </section>

      <section aria-labelledby="questions-heading">
        <h2
          id="questions-heading"
          className="mb-4 text-xl font-semibold text-foreground"
        >
          Questions
        </h2>

        {blocks.length === 0 && !composer ? (
          <EmptyState
            title="No questions yet"
            description="Add a question, or a reading passage with questions about it."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="primary"
                  icon="plus"
                  disabled={locked}
                  onClick={() => setComposer("question")}
                >
                  Add a question
                </Button>
                <Button
                  icon="plus"
                  disabled={locked}
                  onClick={() => setComposer("passage")}
                >
                  Add a passage
                </Button>
              </div>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {blocks.map((block, index) =>
              block.kind === "question" ? (
                <QuestionBlock
                  key={`question-${block.question.id}`}
                  question={block.question}
                  number={starts[index]}
                  actions={actions}
                />
              ) : (
                <PassageBlock
                  key={`passage-${block.passage.id}`}
                  passage={block.passage}
                  firstNumber={starts[index]}
                  actions={actions}
                />
              ),
            )}

            <AnimatePresence mode="wait" initial={false}>
              {composer === "question" ? (
                <QuestionEditor
                  key="new-question"
                  heading={`New question ${next}`}
                  initial={newQuestionDraft()}
                  ownTimer
                  quizDisplayMode={quiz.displayMode}
                  submitLabel="Add question"
                  onCancel={() => setComposer(null)}
                  onSubmit={async (draft) => {
                    await editor.addQuestion(draft);
                    setComposer(null);
                  }}
                />
              ) : composer === "passage" ? (
                <PassageComposer
                  key="new-passage"
                  quizDisplayMode={quiz.displayMode}
                  onCancel={() => setComposer(null)}
                  onCreate={async (draft, questions) => {
                    await editor.addPassage(draft, questions);
                    setComposer(null);
                  }}
                />
              ) : (
                !locked && (
                  <motion.div
                    key="add"
                    {...fade}
                    className="flex flex-wrap items-center justify-center gap-3 border border-dashed border-border-strong px-4 py-5"
                  >
                    <Button
                      variant="ghost"
                      icon="plus"
                      onClick={() => setComposer("question")}
                    >
                      Add question
                    </Button>
                    <span aria-hidden className="h-5 w-px bg-border-strong" />
                    <Button
                      variant="ghost"
                      icon="plus"
                      onClick={() => setComposer("passage")}
                    >
                      Add passage
                    </Button>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>
        )}
      </section>

      <SessionList
        sessions={editor.sessions}
        onDiscard={(session) => {
          setDiscardTarget(session);
          setDiscardOpen(true);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={
          deleteTarget?.kind === "passage"
            ? "Delete this passage?"
            : `Delete question ${deleteTarget?.number ?? ""}?`
        }
        description={
          deleteTarget?.kind === "passage"
            ? `Its ${countLabel(deleteTarget.questionCount, "question goes", "questions go")} with it. This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete"
        onConfirm={() =>
          deleteTarget?.kind === "passage"
            ? editor.deletePassage(deleteTarget.id)
            : deleteTarget && editor.deleteQuestion(deleteTarget.id)
        }
      />

      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard this session?"
        description="Everyone in it is disconnected, and its players and answers are deleted. The quiz becomes editable again."
        confirmLabel="Discard session"
        onConfirm={() =>
          discardTarget && editor.discardSession(discardTarget.id)
        }
      />
    </Page>
  );
}

export function QuizEditorSkeleton() {
  return (
    <Page>
      <LoadingRegion label="Loading quiz">
        <PageHeaderSkeleton crumbs action titleWidth="w-72" />
        <Skeleton className="mb-12 h-32 w-full" />
        <Skeleton className="mb-4 h-7 w-28" />
        <div className="flex flex-col gap-3">
          {[0, 1].map((block) => (
            <div key={block} className="border border-border bg-surface p-6">
              <Skeleton className="h-5 w-40 bg-border" />
              <Skeleton className="mt-3 h-7 w-3/4 bg-border" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[0, 1, 2, 3].map((option) => (
                  <Skeleton key={option} className="h-12 bg-background" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </LoadingRegion>
    </Page>
  );
}
