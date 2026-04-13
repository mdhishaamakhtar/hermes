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
  type QuestionDraftOption,
} from "@/components/quizzes/editor-model";
import CustomSelect from "@/components/ui/CustomSelect";
import type { DisplayMode, Question, QuestionType } from "@/lib/types";

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
  const [editTime, setEditTime] = useState<number | string>(30);
  const [editQuestionType, setEditQuestionType] =
    useState<QuestionType>("SINGLE_SELECT");
  const [editDisplayModeOverride, setEditDisplayModeOverride] = useState<
    DisplayMode | "INHERIT"
  >("INHERIT");
  const [editOptions, setEditOptions] = useState<QuestionDraftOption[]>([]);
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

  const setOptionPoints = (targetIndex: number, pointValue: number | string) =>
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
        nested && question.timeLimitSeconds === 0
          ? 0
          : typeof editTime === "string"
            ? parseInt(editTime, 10)
            : editTime,
      displayModeOverride:
        editDisplayModeOverride === "INHERIT" ? null : editDisplayModeOverride,
      options: editOptions.map((option, index) => ({
        text: option.text.trim(),
        pointValue:
          typeof option.pointValue === "string"
            ? parseInt(option.pointValue, 10) || 0
            : option.pointValue,
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
    ? "border-b border-border/50 py-5"
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
                    className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 border border-border/80 px-3 py-2"
                  >
                    <span className="label mt-0.5 text-foreground/75">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                      {option.text}
                    </span>
                    <span
                      className={`mt-0.5 justify-self-end text-right font-mono text-xs tabular-nums ${tone}`}
                    >
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <p className="label text-warning">
              Editing {nested ? "Sub-question" : "Question"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <CustomSelect
                  value={editQuestionType}
                  onChange={(v) => resetOptionsForType(v as QuestionType)}
                  options={QUESTION_TYPE_OPTIONS}
                />
              </div>
              <div className="w-40">
                <CustomSelect
                  value={editDisplayModeOverride}
                  onChange={(v) =>
                    setEditDisplayModeOverride(v as DisplayMode | "INHERIT")
                  }
                  options={[
                    { value: "INHERIT", label: "Inherit from quiz" },
                    ...DISPLAY_MODE_OPTIONS,
                  ]}
                />
              </div>
            </div>
          </div>

          <div
            className={
              nested && question.timeLimitSeconds === 0
                ? "grid gap-4"
                : "grid gap-4 md:grid-cols-[minmax(0,1fr)_7rem]"
            }
          >
            <label className="block">
              <span className="field-label mb-2 block">Question Text</span>
              <textarea
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                rows={2}
                className="input-field min-h-[5rem] resize-y"
              />
            </label>
            {!(nested && question.timeLimitSeconds === 0) ? (
              <label className="block">
                <span className="field-label mb-2 block">Timer</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editTime}
                  onChange={(event) => {
                    const val = event.target.value.replace(/[^0-9]/g, "");
                    setEditTime(val === "" ? 0 : parseInt(val, 10));
                  }}
                  className="input-field font-mono tabular-nums"
                />
              </label>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="label text-muted">Options</p>
              <button
                type="button"
                onClick={addOption}
                className="label text-accent transition-colors hover:text-accent-hover"
              >
                + Add
              </button>
            </div>

            <div className="space-y-1">
              {editOptions.map((option, optionIndex) => (
                <div
                  key={optionIndex}
                  className="grid grid-cols-[2rem_minmax(0,1fr)_3.75rem_1.75rem] items-start gap-2 border-b border-border/50 py-2"
                >
                  <span className="label shrink-0 text-foreground/80">
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <textarea
                    value={option.text}
                    onChange={(event) =>
                      setOptionText(optionIndex, event.target.value)
                    }
                    rows={2}
                    className="input-field min-w-0 resize-y py-2 px-3 leading-6"
                    placeholder={`Option ${optionIndex + 1}`}
                  />
                  <input
                    type="text"
                    value={option.pointValue}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (raw === "-" || raw === "") {
                        setOptionPoints(optionIndex, raw);
                        return;
                      }
                      const parsed = parseInt(raw, 10);
                      if (!isNaN(parsed)) {
                        setOptionPoints(optionIndex, parsed);
                      }
                    }}
                    className="input-field h-full min-h-16 py-2 px-2 text-center font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(optionIndex)}
                    disabled={editOptions.length <= 2}
                    className="flex items-center justify-center label text-muted transition-colors hover:text-danger disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {validationError && (
            <p className="mt-4 text-sm text-danger">{validationError}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-warning px-5 py-3 text-sm font-medium tracking-[0.12em] text-white uppercase transition-colors hover:bg-warning-hover disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save Changes"}
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
