"use client";

import { useId, useState, type CSSProperties, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { describeError } from "@/lib/api";
import { formatPoints } from "@/lib/format";
import { fade, rise } from "@/lib/motion";
import { byOrderIndex, optionColor, optionLetter } from "@/lib/options";
import type {
  DisplayMode,
  Passage,
  PassageTimerMode,
  Question,
} from "@/lib/types";
import {
  displayModeLabel,
  draftFromPassage,
  draftFromQuestion,
  newPassageDraft,
  newQuestionDraft,
  questionTypeLabel,
  TIMER_MODES,
  validatePassage,
  validateQuestion,
  type PassageDraft,
  type QuestionDraft,
} from "./editor-model";
import { QuestionEditor, QuestionFields } from "./QuestionEditor";

/** What a block needs from the editor to save and delete itself. */
export interface BlockActions {
  quizDisplayMode: DisplayMode;
  locked: boolean;
  saveQuestion: (
    question: Question,
    draft: QuestionDraft,
    ownTimer: boolean,
  ) => Promise<void>;
  savePassage: (passage: Passage, draft: PassageDraft) => Promise<void>;
  addSubQuestion: (passage: Passage, draft: QuestionDraft) => Promise<void>;
  requestDelete: (target: DeleteTarget) => void;
}

export type DeleteTarget =
  | { kind: "question"; id: number; number: number }
  | { kind: "passage"; id: number; questionCount: number };

function BlockActionsBar({
  label,
  locked,
  onEdit,
  onDelete,
}: {
  label: string;
  locked: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        icon="pencil"
        aria-label={`Edit ${label}`}
        title="Edit"
        disabled={locked}
        onClick={onEdit}
      />
      <Button
        variant="ghost"
        size="sm"
        icon="trash"
        aria-label={`Delete ${label}`}
        title="Delete"
        disabled={locked}
        onClick={onDelete}
        className="hover:text-danger"
      />
    </div>
  );
}

/* ── Questions ────────────────────────────────────────────────────────────── */

export function QuestionBlock({
  question,
  number,
  passage,
  actions,
}: {
  question: Question;
  /** Position in the running order, as players will see it. */
  number: number;
  /** The passage this question sits in, if any. */
  passage?: Passage;
  actions: BlockActions;
}) {
  const [editing, setEditing] = useState(false);
  const ownTimer = !passage || passage.timerMode === "PER_SUB_QUESTION";
  const missingTimer = ownTimer && question.timeLimitSeconds <= 0;

  if (editing) {
    return (
      <QuestionEditor
        heading={`Edit question ${number}`}
        initial={draftFromQuestion(question)}
        ownTimer={ownTimer}
        quizDisplayMode={actions.quizDisplayMode}
        submitLabel="Save question"
        onCancel={() => setEditing(false)}
        onSubmit={async (draft) => {
          await actions.saveQuestion(question, draft, ownTimer);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <motion.article
      {...fade}
      className={
        passage ? "py-5" : "border border-border bg-surface p-5 sm:p-6"
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-subtle">
            <span className="font-mono font-medium text-muted">Q{number}</span>
            <span aria-hidden>·</span>
            <span>{questionTypeLabel(question.questionType)}</span>
            {ownTimer && !missingTimer && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">
                  {question.timeLimitSeconds} sec
                </span>
              </>
            )}
            {question.displayModeOverride && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {displayModeLabel(question.displayModeOverride)} display
                </span>
              </>
            )}
            {missingTimer && <Badge tone="warning">Needs a timer</Badge>}
          </p>
          <h3 className="mt-2 text-lg leading-snug font-semibold whitespace-pre-wrap text-foreground">
            {question.text}
          </h3>
        </div>
        <BlockActionsBar
          label={`question ${number}`}
          locked={actions.locked}
          onEdit={() => setEditing(true)}
          onDelete={() =>
            actions.requestDelete({ kind: "question", id: question.id, number })
          }
        />
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {byOrderIndex(question.options).map((option, index) => (
          <li
            key={option.id}
            className="option-tile py-2.5"
            data-state={option.pointValue > 0 ? "correct" : undefined}
            style={{ "--option": optionColor(index) } as CSSProperties}
          >
            <span className="option-letter">
              {option.pointValue > 0 ? (
                <Icon name="check" size={14} />
              ) : (
                optionLetter(index)
              )}
            </span>
            <span className="min-w-0 text-sm break-words whitespace-pre-wrap text-foreground">
              {option.pointValue > 0 && (
                <span className="sr-only">Correct answer: </span>
              )}
              {option.text}
            </span>
            {option.pointValue !== 0 && (
              <span
                className={`font-mono text-xs ${
                  option.pointValue > 0 ? "text-success" : "text-danger"
                }`}
              >
                {formatPoints(option.pointValue)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

/* ── Passages ─────────────────────────────────────────────────────────────── */

export function PassageBlock({
  passage,
  firstNumber,
  actions,
}: {
  passage: Passage;
  /** Running-order number of its first question. */
  firstNumber: number;
  actions: BlockActions;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const questions = byOrderIndex(passage.subQuestions);
  const lastNumber = firstNumber + Math.max(0, questions.length - 1);
  const isLong = passage.text.length > 600;

  if (editing) {
    return (
      <PassageEditor
        passage={passage}
        onCancel={() => setEditing(false)}
        onSave={async (draft) => {
          await actions.savePassage(passage, draft);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <motion.section
      {...fade}
      aria-label={`Passage with questions ${firstNumber} to ${lastNumber}`}
      className="border border-border bg-surface"
    >
      <div className="border-b border-border p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-subtle">
            <span className="font-medium text-muted">Passage</span>
            <span aria-hidden>·</span>
            <span className="font-mono">
              Q{firstNumber}
              {lastNumber > firstNumber && `–Q${lastNumber}`}
            </span>
            <span aria-hidden>·</span>
            <span>
              {passage.timerMode === "ENTIRE_PASSAGE"
                ? `All together, ${passage.timeLimitSeconds ?? 0} sec`
                : "One at a time"}
            </span>
          </p>
          <BlockActionsBar
            label="passage"
            locked={actions.locked}
            onEdit={() => setEditing(true)}
            onDelete={() =>
              actions.requestDelete({
                kind: "passage",
                id: passage.id,
                questionCount: questions.length,
              })
            }
          />
        </div>
        <p
          className={`mt-3 max-w-[72ch] text-base leading-7 whitespace-pre-wrap text-foreground/90 ${
            isLong && !expanded ? "line-clamp-6" : ""
          }`}
        >
          {passage.text}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mt-2 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            {expanded ? "Show less" : "Show the whole passage"}
          </button>
        )}
      </div>

      <div className="divide-y divide-border px-5 sm:px-6">
        {questions.map((question, index) => (
          <QuestionBlock
            key={question.id}
            question={question}
            number={firstNumber + index}
            passage={passage}
            actions={actions}
          />
        ))}
      </div>

      <div className="border-t border-border p-4 sm:px-6">
        <AnimatePresence initial={false} mode="wait">
          {adding ? (
            <QuestionEditor
              key="add"
              heading={`New question ${lastNumber + (questions.length ? 1 : 0)}`}
              initial={newQuestionDraft()}
              ownTimer={passage.timerMode === "PER_SUB_QUESTION"}
              quizDisplayMode={actions.quizDisplayMode}
              submitLabel="Add question"
              onCancel={() => setAdding(false)}
              onSubmit={async (draft) => {
                await actions.addSubQuestion(passage, draft);
                setAdding(false);
              }}
            />
          ) : (
            <motion.div key="button" {...fade}>
              <Button
                variant="ghost"
                size="sm"
                icon="plus"
                disabled={actions.locked}
                onClick={() => setAdding(true)}
              >
                Add a question to this passage
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

function PassageSettings({
  draft,
  onChange,
}: {
  draft: PassageDraft;
  onChange: (next: PassageDraft) => void;
}) {
  const timingId = useId();
  return (
    <div className="flex flex-col gap-5">
      <TextAreaField
        label="Passage"
        value={draft.text}
        onChange={(event) => onChange({ ...draft, text: event.target.value })}
        rows={6}
        placeholder="The text players read before answering."
        className="min-h-40 leading-7"
        autoFocus
      />
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-start">
        <Field id={timingId} label="Questions appear">
          <SegmentedControl<PassageTimerMode>
            id={timingId}
            value={draft.timerMode}
            options={TIMER_MODES}
            onChange={(timerMode) => onChange({ ...draft, timerMode })}
          />
        </Field>
        {draft.timerMode === "ENTIRE_PASSAGE" && (
          <TextField
            label="Shared timer"
            suffix="sec"
            inputMode="numeric"
            value={draft.timeLimitSeconds}
            onChange={(event) =>
              onChange({
                ...draft,
                timeLimitSeconds: event.target.value.replace(/\D/g, ""),
              })
            }
            className="font-mono tabular-nums"
          />
        )}
      </div>
    </div>
  );
}

function PassageEditor({
  passage,
  onSave,
  onCancel,
}: {
  passage: Passage;
  onSave: (draft: PassageDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => draftFromPassage(passage));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const losesSharedTimer =
    passage.timerMode === "ENTIRE_PASSAGE" &&
    draft.timerMode === "PER_SUB_QUESTION";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = validatePassage(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (err) {
      setError(describeError(err, "Couldn't save the passage."));
      setPending(false);
    }
  };

  return (
    <motion.form
      {...rise}
      onSubmit={submit}
      aria-label="Edit passage"
      className="border border-primary/40 bg-surface p-5 sm:p-6"
    >
      <h3 className="mb-5 text-base font-semibold text-foreground">
        Edit passage
      </h3>
      <PassageSettings draft={draft} onChange={setDraft} />
      {losesSharedTimer && (
        <Alert tone="warning" className="mt-5">
          Each question then needs its own timer. Edit the questions to set one
          after saving.
        </Alert>
      )}
      {error && <Alert className="mt-5">{error}</Alert>}
      <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
        <Button type="submit" variant="primary" pending={pending}>
          {pending ? "Saving…" : "Save passage"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </motion.form>
  );
}

/**
 * A new passage and its first questions, saved together: the server will
 * not store a passage without at least one question.
 */
export function PassageComposer({
  quizDisplayMode,
  onCreate,
  onCancel,
}: {
  quizDisplayMode: DisplayMode;
  onCreate: (draft: PassageDraft, questions: QuestionDraft[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<PassageDraft>(newPassageDraft);
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => [
    newQuestionDraft(),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ownTimer = draft.timerMode === "PER_SUB_QUESTION";

  const updateQuestion = (index: number, next: QuestionDraft) =>
    setQuestions((current) => current.map((q, i) => (i === index ? next : q)));

  const move = (index: number, by: -1 | 1) =>
    setQuestions((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem =
      validatePassage(draft) ??
      questions
        .map((question, index) => {
          const invalid = validateQuestion(question, { ownTimer });
          return invalid && `Question ${index + 1}: ${invalid}`;
        })
        .find(Boolean);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onCreate(draft, questions);
    } catch (err) {
      setError(describeError(err, "Couldn't create the passage."));
      setPending(false);
    }
  };

  return (
    <motion.form
      {...rise}
      onSubmit={submit}
      aria-label="New passage"
      className="border border-primary/40 bg-surface p-5 sm:p-6"
    >
      <h3 className="mb-5 text-base font-semibold text-foreground">
        New passage
      </h3>
      <PassageSettings draft={draft} onChange={setDraft} />

      <ol className="mt-8 flex flex-col gap-4">
        {questions.map((question, index) => (
          <li
            key={index}
            className="border border-border bg-background p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted">
                Question {index + 1}
              </p>
              {questions.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="arrow-up"
                    aria-label={`Move question ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="arrow-down"
                    aria-label={`Move question ${index + 1} down`}
                    disabled={index === questions.length - 1}
                    onClick={() => move(index, 1)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="close"
                    aria-label={`Remove question ${index + 1}`}
                    onClick={() =>
                      setQuestions((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    className="hover:text-danger"
                  />
                </div>
              )}
            </div>
            <QuestionFields
              draft={question}
              onChange={(next) => updateQuestion(index, next)}
              ownTimer={ownTimer}
              quizDisplayMode={quizDisplayMode}
              // The passage text takes focus first; questions added later
              // take it as they appear.
              autoFocus={index > 0}
            />
          </li>
        ))}
      </ol>
      <Button
        variant="ghost"
        size="sm"
        icon="plus"
        className="mt-3"
        onClick={() =>
          setQuestions((current) => [...current, newQuestionDraft()])
        }
      >
        Add another question
      </Button>

      {error && <Alert className="mt-6">{error}</Alert>}
      <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
        <Button type="submit" variant="primary" pending={pending}>
          {pending ? "Creating…" : "Add passage"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </motion.form>
  );
}
