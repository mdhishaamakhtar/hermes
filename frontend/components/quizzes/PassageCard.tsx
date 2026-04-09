"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { passagesApi } from "@/lib/apiClient";
import QuestionCard from "@/components/quizzes/QuestionCard";
import QuestionDraftEditor from "@/components/quizzes/QuestionDraftEditor";
import CustomSelect from "@/components/ui/CustomSelect";
import {
  createQuestionDraft,
  passageTimerModeLabel,
  PASSAGE_TIMER_MODE_OPTIONS,
  validateQuestionDraft,
} from "@/components/quizzes/editor-model";
import type { Passage, PassageTimerMode, Question } from "@/lib/types";
import type { QuestionDraft } from "@/components/quizzes/editor-model";

interface Props {
  passage: Passage;
  disabled: boolean;
  onDelete: (id: number) => void;
  onSaved: (updated: Passage) => void;
  onSubQuestionAdded: (passageId: number, question: Question) => void;
  onSubQuestionSaved: (updated: Question) => void;
  onSubQuestionDeleted: (questionId: number) => void;
  onEditOpen: () => void;
}

function passageSummary(passage: Passage): string {
  if (passage.timerMode === "ENTIRE_PASSAGE") {
    return `${passage.timeLimitSeconds ?? 0}s shared timer`;
  }

  return `${passage.subQuestions.length} timed sub-question${
    passage.subQuestions.length === 1 ? "" : "s"
  }`;
}

export default function PassageCard({
  passage,
  disabled,
  onDelete,
  onSaved,
  onSubQuestionAdded,
  onSubQuestionSaved,
  onSubQuestionDeleted,
  onEditOpen,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(passage.text);
  const [editTimerMode, setEditTimerMode] = useState<PassageTimerMode>(
    passage.timerMode,
  );
  const [editTimeLimitSeconds, setEditTimeLimitSeconds] = useState<
    number | string
  >(passage.timeLimitSeconds ?? 120);
  const [saving, setSaving] = useState(false);
  const [showSubQuestionForm, setShowSubQuestionForm] = useState(false);
  const [subQuestionDraft, setSubQuestionDraft] = useState<QuestionDraft>(
    createQuestionDraft(passage.subQuestions.length),
  );
  const [creatingSubQuestion, setCreatingSubQuestion] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortedSubQuestions = passage.subQuestions.toSorted(
    (a, b) => a.orderIndex - b.orderIndex,
  );

  const openEdit = () => {
    setEditText(passage.text);
    setEditTimerMode(passage.timerMode);
    setEditTimeLimitSeconds(passage.timeLimitSeconds ?? 120);
    setErrorMessage(null);
    setIsEditing(true);
    setShowSubQuestionForm(false);
    onEditOpen();
  };

  const validatePassage = () => {
    if (!editText.trim()) return "Passage text is required.";
    const timeVal =
      typeof editTimeLimitSeconds === "string"
        ? parseInt(editTimeLimitSeconds, 10)
        : editTimeLimitSeconds;
    if (editTimerMode === "ENTIRE_PASSAGE" && (isNaN(timeVal) || timeVal < 5)) {
      return "Shared passage timing must be at least 5 seconds.";
    }

    return null;
  };

  const savePassageAction = async () => {
    const validationError = validatePassage();
    if (validationError) {
      setErrorMessage(validationError);
      return null;
    }

    setErrorMessage(null);
    setSaving(true);

    const response = await passagesApi.update(passage.id, {
      text: editText.trim(),
      orderIndex: passage.orderIndex,
      timerMode: editTimerMode,
      timeLimitSeconds:
        editTimerMode === "ENTIRE_PASSAGE"
          ? typeof editTimeLimitSeconds === "string"
            ? parseInt(editTimeLimitSeconds, 10)
            : editTimeLimitSeconds
          : null,
    });

    if (response.success) {
      onSaved(response.data);
      setIsEditing(false);
    } else {
      setErrorMessage(response.error?.message ?? "Failed to save passage.");
    }

    setSaving(false);
    return null;
  };

  const addSubQuestionAction = async () => {
    const validationError = validateQuestionDraft(subQuestionDraft, {
      requirePositiveTimer: passage.timerMode === "PER_SUB_QUESTION",
    });
    if (validationError) {
      setErrorMessage(validationError);
      return null;
    }

    setErrorMessage(null);
    setCreatingSubQuestion(true);

    const response = await passagesApi.addSubQuestion(passage.id, {
      text: subQuestionDraft.text.trim(),
      orderIndex: passage.subQuestions.length,
      timeLimitSeconds:
        passage.timerMode === "PER_SUB_QUESTION"
          ? typeof subQuestionDraft.timeLimitSeconds === "string"
            ? parseInt(subQuestionDraft.timeLimitSeconds, 10)
            : subQuestionDraft.timeLimitSeconds
          : undefined,
      questionType: subQuestionDraft.questionType,
      displayModeOverride: subQuestionDraft.displayModeOverride,
      options: subQuestionDraft.options.map((option, index) => ({
        text: option.text.trim(),
        pointValue:
          typeof option.pointValue === "string"
            ? parseInt(option.pointValue, 10) || 0
            : option.pointValue,
        orderIndex: index,
      })),
    });

    if (response.success) {
      onSubQuestionAdded(passage.id, response.data);
      setShowSubQuestionForm(false);
      setSubQuestionDraft(createQuestionDraft(passage.subQuestions.length + 1));
    } else {
      setErrorMessage(
        response.error?.message ?? "Failed to add passage question.",
      );
    }

    setCreatingSubQuestion(false);
    return null;
  };

  const [, savePassageFormAction] = useActionState(savePassageAction, null);
  const [, addSubQuestionFormAction] = useActionState(
    addSubQuestionAction,
    null,
  );

  return (
    <AnimatePresence mode="wait" initial>
      {!isEditing ? (
        <motion.section
          key="view"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18 }}
          className="border border-accent/35 bg-surface"
        >
          <div className="border-b border-accent/20 px-5 py-5 md:px-6 md:py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="label text-accent">
                    Passage {passage.orderIndex}
                  </span>
                  <span className="text-xs text-muted/50">/</span>
                  <span className="text-xs text-muted">
                    {passageTimerModeLabel(passage.timerMode)}
                  </span>
                  <span className="text-xs text-muted/50">/</span>
                  <span className="text-xs text-muted">
                    {passageSummary(passage)}
                  </span>
                </div>
                <p className="max-w-[72ch] whitespace-pre-wrap text-sm leading-7 text-foreground">
                  {passage.text}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={openEdit}
                  disabled={disabled}
                  className="label text-muted transition-colors hover:text-accent disabled:opacity-35"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSubQuestionForm((current) => !current);
                    setErrorMessage(null);
                    onEditOpen();
                  }}
                  disabled={disabled}
                  className="label text-muted transition-colors hover:text-accent disabled:opacity-35"
                >
                  {showSubQuestionForm ? "Close composer" : "Add sub-question"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(passage.id)}
                  disabled={disabled}
                  className="label text-muted transition-colors hover:text-danger disabled:opacity-35"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          <div className="px-5 py-5 md:px-6 md:py-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label text-muted">Sub-questions</p>
              </div>
              <span className="font-mono text-xs text-muted tabular-nums">
                {sortedSubQuestions.length} total
              </span>
            </div>

            {showSubQuestionForm ? (
              <motion.form
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                action={addSubQuestionFormAction}
                className="mb-4 border border-border/80 bg-background/35 px-4 py-4"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-4">
                  <div>
                    <p className="label text-accent">New Sub-question</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSubQuestionForm(false)}
                    className="label text-muted transition-colors hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>

                <QuestionDraftEditor
                  draft={subQuestionDraft}
                  title={`Sub-question ${sortedSubQuestions.length + 1}`}
                  timerLocked={passage.timerMode === "ENTIRE_PASSAGE"}
                  showDisplayMode
                  onChange={setSubQuestionDraft}
                />

                {errorMessage ? (
                  <p className="mt-4 text-sm text-danger">{errorMessage}</p>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={creatingSubQuestion}
                    className="btn-primary px-5 py-3"
                  >
                    {creatingSubQuestion ? "Adding…" : "Add Sub-question"}
                  </button>
                </div>
              </motion.form>
            ) : null}

            <div className="space-y-3">
              {sortedSubQuestions.map((question, index) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  disabled={disabled}
                  nested
                  onDelete={onSubQuestionDeleted}
                  onSaved={onSubQuestionSaved}
                  onEditOpen={onEditOpen}
                />
              ))}
            </div>
          </div>
        </motion.section>
      ) : (
        <motion.form
          key="edit"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
          action={savePassageFormAction}
          className="border border-warning/35 bg-surface px-5 py-5 md:px-6 md:py-6"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="label mb-2 text-warning">Editing Passage</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn-ghost px-5 py-3"
            >
              Cancel
            </button>
          </div>

          <label className="block">
            <span className="field-label mb-2 block">Passage Text</span>
            <textarea
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              rows={7}
              className="input-field min-h-[12rem] resize-y"
            />
          </label>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_9rem]">
            <label className="block">
              <span className="field-label mb-2 block">Timer Mode</span>
              <CustomSelect
                value={editTimerMode}
                onChange={(v) => setEditTimerMode(v as PassageTimerMode)}
                options={PASSAGE_TIMER_MODE_OPTIONS}
              />
            </label>

            {editTimerMode === "ENTIRE_PASSAGE" ? (
              <label className="block">
                <span className="field-label mb-2 block">Shared Timer</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editTimeLimitSeconds}
                  onChange={(event) => {
                    const val = event.target.value.replace(/[^0-9]/g, "");
                    setEditTimeLimitSeconds(val === "" ? 0 : parseInt(val, 10));
                  }}
                  className="input-field font-mono tabular-nums"
                />
              </label>
            ) : (
              <div className="flex items-end pb-3">
                <p className="text-xs text-muted">Sub-question timers active</p>
              </div>
            )}
          </div>

          {errorMessage ? (
            <p className="mt-4 text-sm text-danger">{errorMessage}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-warning px-5 py-3 text-sm font-medium tracking-[0.12em] text-white uppercase transition-colors hover:bg-warning-hover disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
