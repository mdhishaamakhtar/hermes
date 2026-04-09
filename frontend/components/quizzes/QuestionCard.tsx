"use client";

import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { questionsApi } from "@/lib/apiClient";
import {
  DISPLAY_MODE_OPTIONS,
  displayModeLabel,
  effectiveQuestionTimer,
  normalizeOptionsForQuestionType,
  QUESTION_TYPE_OPTIONS,
  questionTypeLabel,
  validateQuestionDraft,
} from "@/components/quizzes/editor-model";
import type {
  DisplayMode,
  Question,
  QuestionOptionInput,
  QuestionType,
} from "@/lib/types";

interface Props {
  question: Question;
  index: number;
  disabled: boolean;
  nested?: boolean;
  onDelete: (id: number) => void;
  onSaved: (updated: Question) => void;
  onEditOpen: () => void;
}

export default function QuestionCard({
  question,
  index,
  disabled,
  nested = false,
  onDelete,
  onSaved,
  onEditOpen,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editTime, setEditTime] = useState(30);
  const [editQuestionType, setEditQuestionType] =
    useState<QuestionType>("SINGLE_SELECT");
  const [editDisplayModeOverride, setEditDisplayModeOverride] = useState<
    DisplayMode | "INHERIT"
  >("INHERIT");
  const [editOptions, setEditOptions] = useState<QuestionOptionInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const openEdit = () => {
    setEditText(question.text);
    setEditTime(question.timeLimitSeconds > 0 ? question.timeLimitSeconds : 30);
    setEditQuestionType(question.questionType);
    setEditDisplayModeOverride(question.displayModeOverride ?? "INHERIT");
    setEditOptions(
      question.options.map((option) => ({
        text: option.text,
        pointValue: option.pointValue,
        orderIndex: option.orderIndex,
      })),
    );
    setValidationError(null);
    setIsEditing(true);
    onEditOpen();
  };

  const setOptionText = (targetIndex: number, text: string) =>
    setEditOptions((current) =>
      current.map((option, index) =>
        index === targetIndex ? { ...option, text } : option,
      ),
    );

  const setOptionPoints = (targetIndex: number, pointValue: number) =>
    setEditOptions((current) =>
      current.map((option, index) =>
        index === targetIndex ? { ...option, pointValue } : option,
      ),
    );

  const addOption = () =>
    setEditOptions((current) => [
      ...current,
      { text: "", pointValue: 0, orderIndex: current.length },
    ]);

  const removeOption = (targetIndex: number) =>
    setEditOptions((current) =>
      current
        .filter((_, index) => index !== targetIndex)
        .map((option, index) => ({ ...option, orderIndex: index })),
    );

  const resetOptionsForType = (nextType: QuestionType) => {
    setEditQuestionType(nextType);
    setEditOptions((current) =>
      normalizeOptionsForQuestionType(nextType, current),
    );
  };

  const validate = () => {
    return validateQuestionDraft(
      {
        text: editText,
        timeLimitSeconds: editTime,
        questionType: editQuestionType,
        options: editOptions,
      },
      {
        requirePositiveTimer: !nested || question.timeLimitSeconds !== 0,
      },
    );
  };

  const saveEditAction = async () => {
    const error = validate();
    if (error) {
      setValidationError(error);
      return null;
    }

    setValidationError(null);
    setSaving(true);

    const res = await questionsApi.update(question.id, {
      text: editText.trim(),
      questionType: editQuestionType,
      orderIndex: question.orderIndex,
      timeLimitSeconds:
        nested && question.timeLimitSeconds === 0 ? 0 : editTime,
      displayModeOverride:
        editDisplayModeOverride === "INHERIT" ? null : editDisplayModeOverride,
      options: editOptions.map((option, index) => ({
        text: option.text.trim(),
        pointValue: option.pointValue,
        orderIndex: index,
      })),
    });

    if (res.success) {
      onSaved(res.data);
      setIsEditing(false);
    } else {
      setValidationError(res.error?.message ?? "Failed to save question.");
    }

    setSaving(false);
    return null;
  };

  const [, saveFormAction] = useActionState(saveEditAction, null);
  const shellClass = nested
    ? "border border-border/70 bg-background/35 px-4 py-4"
    : "border border-border bg-surface px-5 py-5 md:px-6 md:py-6";

  return (
    <AnimatePresence mode="wait" initial>
      {!isEditing ? (
        <motion.div
          key="view"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18, delay: index * 0.03 }}
          className={shellClass}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="label mt-1 text-foreground/80">
                {nested
                  ? `${question.orderIndex + 1}`
                  : `Q${question.orderIndex}`}
              </span>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="label text-accent">
                    {questionTypeLabel(question.questionType)}
                  </span>
                  <span className="text-xs text-muted/50">/</span>
                  <span className="text-xs text-muted">
                    {effectiveQuestionTimer(question)}
                  </span>
                  <span className="text-xs text-muted/50">/</span>
                  <span className="text-xs text-muted">
                    {question.displayModeOverride
                      ? displayModeLabel(question.displayModeOverride)
                      : `Inherit ${displayModeLabel(question.effectiveDisplayMode)}`}
                  </span>
                </div>
                <p className="max-w-[65ch] text-base font-semibold leading-relaxed text-foreground">
                  {question.text}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={openEdit}
                disabled={disabled}
                className="label text-muted transition-colors hover:text-accent disabled:opacity-35"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(question.id)}
                disabled={disabled}
                className="label text-muted transition-colors hover:text-danger disabled:opacity-35"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {question.options
              .toSorted((a, b) => a.orderIndex - b.orderIndex)
              .map((option, optionIndex) => {
                const tone =
                  option.pointValue > 0
                    ? "border-success/35 text-success"
                    : option.pointValue < 0
                      ? "border-danger/35 text-danger"
                      : "border-border text-muted";

                return (
                  <div
                    key={option.id}
                    className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border border-border/80 px-3 py-2"
                  >
                    <span className="label text-foreground/75">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="truncate text-sm text-foreground">
                      {option.text}
                    </span>
                    <span className={`font-mono text-xs tabular-nums ${tone}`}>
                      {option.pointValue > 0
                        ? `+${option.pointValue}`
                        : option.pointValue}
                    </span>
                  </div>
                );
              })}
          </div>
        </motion.div>
      ) : (
        <motion.form
          key="edit"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
          action={saveFormAction}
          className={shellClass}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="label mb-2 text-warning">
                Editing {nested ? "Sub-question" : "Question"}
              </p>
              <h3 className="text-lg font-bold text-foreground">
                Tight scoring, clear stage behavior
              </h3>
            </div>
            <div className="grid min-w-[16rem] gap-3 md:grid-cols-2">
              <label className="block">
                <span className="field-label mb-2 block">Question Type</span>
                <select
                  value={editQuestionType}
                  onChange={(event) =>
                    resetOptionsForType(event.target.value as QuestionType)
                  }
                  className="input-field"
                >
                  {QUESTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label mb-2 block">Display Mode</span>
                <select
                  value={editDisplayModeOverride}
                  onChange={(event) =>
                    setEditDisplayModeOverride(
                      event.target.value as DisplayMode | "INHERIT",
                    )
                  }
                  className="input-field"
                >
                  <option value="INHERIT">Inherit from quiz</option>
                  {DISPLAY_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_7rem]">
            <label className="block">
              <span className="field-label mb-2 block">Question Text</span>
              <textarea
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                rows={3}
                className="input-field min-h-[7rem] resize-y"
              />
            </label>
            <label className="block">
              <span className="field-label mb-2 block">Timer</span>
              <input
                type="number"
                min={nested ? 0 : 5}
                value={editTime}
                onChange={(event) => setEditTime(Number(event.target.value))}
                className="input-field font-mono tabular-nums"
                disabled={nested && question.timeLimitSeconds === 0}
              />
              <p className="mt-2 text-xs text-muted">
                {nested && question.timeLimitSeconds === 0
                  ? "Shared with the parent passage."
                  : "Seconds per prompt."}
              </p>
            </label>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="label text-muted">Option matrix</p>
                <p className="mt-1 text-sm text-muted">
                  Edit scores directly. Positive values reward, negatives
                  punish, zero stays quiet.
                </p>
              </div>
              <button
                type="button"
                onClick={addOption}
                className="label text-accent transition-colors hover:text-accent-hover"
              >
                + Add option
              </button>
            </div>

            <div className="space-y-3">
              {editOptions.map((option, optionIndex) => (
                <div
                  key={optionIndex}
                  className="grid gap-3 border border-border px-4 py-3 md:grid-cols-[3rem_minmax(0,1fr)_7rem_auto]"
                >
                  <span className="label self-center text-foreground/80">
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <input
                    value={option.text}
                    onChange={(event) =>
                      setOptionText(optionIndex, event.target.value)
                    }
                    className="input-field"
                    placeholder={`Option ${optionIndex + 1}`}
                  />
                  <input
                    type="number"
                    value={option.pointValue}
                    onChange={(event) =>
                      setOptionPoints(optionIndex, Number(event.target.value))
                    }
                    className="input-field font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(optionIndex)}
                    disabled={editOptions.length <= 2}
                    className="label self-center text-muted transition-colors hover:text-danger disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {validationError && (
            <p className="mt-4 text-sm text-danger">{validationError}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-warning px-5 py-3 text-sm font-medium tracking-[0.12em] text-white uppercase transition-colors hover:bg-warning-hover disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn-ghost px-5 py-3"
            >
              Cancel
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
