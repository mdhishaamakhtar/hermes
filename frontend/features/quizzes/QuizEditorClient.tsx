"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  Reorder,
  useDragControls,
} from "motion/react";
import { LeaveGuard } from "@/components/LeaveGuard";
import { LoadError } from "@/components/LoadError";
import { Page, PageHeader, PageHeaderSkeleton } from "@/components/Page";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { describeError } from "@/lib/api";
import { countLabel } from "@/lib/format";
import { fade } from "@/lib/motion";
import type { DisplayMode, SessionSummary } from "@/lib/types";
import {
  DISPLAY_MODES,
  displayChoice,
  newQuestionDraft,
  questionCount,
  quizBlocks,
  SPEED_SCORING,
  type QuizBlock,
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

const blockKey = (block: QuizBlock) =>
  block.kind === "question"
    ? `question-${block.question.id}`
    : `passage-${block.passage.id}`;

export function QuizEditorClient({
  eventId,
  quizId,
}: {
  eventId: string;
  quizId: string;
}) {
  const router = useRouter();
  const editor = useQuizEditor(quizId);
  const { quiz, runningSession } = editor;
  const displayId = useId();
  const speedId = useId();

  const [composer, setComposer] = useState<Composer>(null);
  // The running order while a block is being dragged, before it is saved.
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [launching, setLaunching] = useState<"session" | "rehearsal" | null>(
    null,
  );
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

  const saved = quizBlocks(quiz);
  const blocks = dragOrder
    ? dragOrder
        .map((key) => saved.find((block) => blockKey(block) === key))
        .filter((block): block is QuizBlock => Boolean(block))
    : saved;
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
    duplicateQuestion: async (questionId) => {
      try {
        await editor.duplicateQuestion(questionId);
      } catch (err) {
        toast.error(describeError(err, "Couldn't duplicate the question."));
      }
    },
    requestDelete: (target) => {
      setDeleteTarget(target);
      setDeleteOpen(true);
    },
  };

  const launch = async (kind: "session" | "rehearsal") => {
    setLaunching(kind);
    setLaunchError(null);
    try {
      const sessionId = await editor.launch({
        rehearsal: kind === "rehearsal",
      });
      router.push(`/session/${sessionId}/host`);
    } catch (err) {
      setLaunchError(describeError(err, "Couldn't open a lobby."));
      setLaunching(null);
    }
  };

  /** Saves a new running order; a refusal puts the saved one back. */
  const saveOrder = async (next: QuizBlock[]) => {
    const unchanged = next.every(
      (block, index) => blockKey(block) === blockKey(saved[index]),
    );
    if (unchanged) {
      setDragOrder(null);
      return;
    }
    setDragOrder(next.map(blockKey));
    try {
      await editor.reorder(next);
    } catch (err) {
      toast.error(describeError(err, "Couldn't save the new order."));
    } finally {
      setDragOrder(null);
    }
  };

  const moveBy = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    void saveOrder(next);
  };

  const changeSettings = async (
    change: Parameters<typeof editor.setSettings>[0],
  ) => {
    try {
      await editor.setSettings(change);
    } catch (err) {
      toast.error(describeError(err, "Couldn't change the quiz settings."));
    }
  };

  return (
    <Page>
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Quizzes" },
          ...(quiz.defaultEvent
            ? []
            : [{ href: `/events/${eventId}`, label: quiz.eventTitle }]),
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
          <>
            <Button
              size="lg"
              icon="phone"
              onClick={() => void launch("rehearsal")}
              pending={launching === "rehearsal"}
              disabled={total === 0 || locked || launching !== null}
              title="Run through it alone, playing along on your phone. Nothing is kept."
            >
              {launching === "rehearsal" ? "Opening…" : "Rehearse"}
            </Button>
            <Button
              variant="primary"
              size="lg"
              icon="play"
              onClick={() => void launch("session")}
              pending={launching === "session"}
              disabled={total === 0 || locked || launching !== null}
              title={total === 0 ? "Add a question first" : undefined}
            >
              {launching === "session" ? "Opening lobby…" : "Start a session"}
            </Button>
          </>
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
          {runningSession.rehearsal ? "A rehearsal" : "A session"} of this quiz
          is{" "}
          {runningSession.status === "LOBBY"
            ? "waiting in the lobby"
            : "live right now"}
          . Editing is locked until it ends.
        </Alert>
      )}

      <section
        aria-label="Quiz settings"
        className="mb-12 grid gap-6 border border-border bg-surface p-5 sm:p-6 lg:grid-cols-2"
      >
        <Field id={displayId} label="Answer display on the big screen">
          <SegmentedControl<DisplayMode>
            id={displayId}
            value={displayChoice(quiz.displayMode)}
            options={DISPLAY_MODES}
            onChange={(displayMode) => void changeSettings({ displayMode })}
            disabled={locked}
          />
        </Field>
        <Field id={speedId} label="Speed scoring">
          <SegmentedControl<"OFF" | "ON">
            id={speedId}
            value={quiz.speedScoring ? "ON" : "OFF"}
            options={SPEED_SCORING}
            onChange={(choice) =>
              void changeSettings({ speedScoring: choice === "ON" })
            }
            disabled={locked}
          />
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
            <Reorder.Group
              as="div"
              axis="y"
              values={blocks.map(blockKey)}
              onReorder={setDragOrder}
              className="flex flex-col gap-3"
            >
              {blocks.map((block, index) => (
                <DraggableBlock
                  key={blockKey(block)}
                  value={blockKey(block)}
                  label={
                    block.kind === "question"
                      ? `question ${starts[index]}`
                      : `the passage at question ${starts[index]}`
                  }
                  disabled={locked || blocks.length < 2}
                  onDrop={() => void saveOrder(blocks)}
                  onMove={(by) => moveBy(index, by)}
                >
                  {(handle) =>
                    block.kind === "question" ? (
                      <QuestionBlock
                        question={block.question}
                        number={starts[index]}
                        actions={actions}
                        handle={handle}
                      />
                    ) : (
                      <PassageBlock
                        passage={block.passage}
                        firstNumber={starts[index]}
                        actions={actions}
                        handle={handle}
                      />
                    )
                  }
                </DraggableBlock>
              ))}
            </Reorder.Group>

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

      <LeaveGuard />

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

/**
 * One block of the running order. It moves by its grip: dragged with a
 * pointer, or with the arrow keys once the grip has focus. Each move saves.
 */
function DraggableBlock({
  value,
  label,
  disabled,
  onDrop,
  onMove,
  children,
}: {
  value: string;
  /** What the block is, for the grip's accessible name. */
  label: string;
  disabled: boolean;
  onDrop: () => void;
  onMove: (by: -1 | 1) => void;
  children: (handle: ReactNode) => ReactNode;
}) {
  const controls = useDragControls();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      onMove(event.key === "ArrowUp" ? -1 : 1);
    }
  };

  const handle = disabled ? null : (
    <button
      type="button"
      aria-label={`Move ${label}. Drag, or use the up and down arrow keys.`}
      title="Drag to move"
      onPointerDown={(event) => controls.start(event)}
      onKeyDown={onKeyDown}
      className="btn btn-ghost btn-sm btn-icon cursor-grab touch-none active:cursor-grabbing"
    >
      <Icon name="grip" size={14} />
    </button>
  );

  return (
    <Reorder.Item
      as="div"
      value={value}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="relative"
      whileDrag={{ zIndex: 20 }}
    >
      {children(handle)}
    </Reorder.Item>
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
