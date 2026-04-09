"use client";

import { useActionState, useState } from "react";
import { motion } from "framer-motion";
import { passagesApi } from "@/lib/apiClient";
import {
  createQuestionDraft,
  PASSAGE_TIMER_MODE_OPTIONS,
  validateQuestionDraft,
} from "@/components/quizzes/editor-model";
import QuestionDraftEditor from "@/components/quizzes/QuestionDraftEditor";
import CustomSelect from "@/components/ui/CustomSelect";
import type { Passage, PassageTimerMode } from "@/lib/types";
import type { QuestionDraft } from "@/components/quizzes/editor-model";

interface Props {
  quizId: string;
  nextOrderIndex: number;
  onAdded: (passage: Passage) => void;
  onCancel: () => void;
}

export default function PassageForm({
  quizId,
  nextOrderIndex,
  onAdded,
  onCancel,
}: Props) {
  const [text, setText] = useState("");
  const [timerMode, setTimerMode] =
    useState<PassageTimerMode>("PER_SUB_QUESTION");
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | string>(
    120,
  );
  const [subQuestions, setSubQuestions] = useState<QuestionDraft[]>([
    createQuestionDraft(0),
  ]);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateDraft = (index: number, next: QuestionDraft) =>
    setSubQuestions((current) =>
      current.map((draft, currentIndex) =>
        currentIndex === index
          ? { ...next, orderIndex: currentIndex }
          : { ...draft, orderIndex: currentIndex },
      ),
    );

  const addSubQuestion = () =>
    setSubQuestions((current) => [
      ...current,
      createQuestionDraft(current.length),
    ]);

  const removeSubQuestion = (index: number) =>
    setSubQuestions((current) =>
      current
        .filter((_, currentIndex) => currentIndex !== index)
        .map((draft, currentIndex) => ({ ...draft, orderIndex: currentIndex })),
    );

  const moveSubQuestion = (index: number, direction: -1 | 1) =>
    setSubQuestions((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((draft, currentIndex) => ({
        ...draft,
        orderIndex: currentIndex,
      }));
    });

  const validate = () => {
    if (!text.trim()) return "Passage text is required.";
    if (!subQuestions.length) return "Passages need at least one sub-question.";
    const timeVal =
      typeof timeLimitSeconds === "string"
        ? parseInt(timeLimitSeconds, 10)
        : timeLimitSeconds;
    if (timerMode === "ENTIRE_PASSAGE" && (isNaN(timeVal) || timeVal <= 0)) {
      return "Shared timer requires a positive value.";
    }
    for (const draft of subQuestions) {
      const draftError = validateQuestionDraft(draft, {
        requirePositiveTimer: timerMode === "PER_SUB_QUESTION",
      });
      if (draftError) return draftError;
    }
    return null;
  };

  const createPassageAction = async () => {
    const error = validate();
    if (error) {
      setValidationError(error);
      return null;
    }

    setValidationError(null);
    setSaving(true);

    const res = await passagesApi.create(quizId, {
      text: text.trim(),
      orderIndex: nextOrderIndex,
      timerMode,
      timeLimitSeconds:
        timerMode === "ENTIRE_PASSAGE"
          ? typeof timeLimitSeconds === "string"
            ? parseInt(timeLimitSeconds, 10)
            : timeLimitSeconds
          : null,
      subQuestions: subQuestions.map((draft, index) => ({
        text: draft.text.trim(),
        questionType: draft.questionType,
        orderIndex: index,
        timeLimitSeconds:
          timerMode === "PER_SUB_QUESTION"
            ? typeof draft.timeLimitSeconds === "string"
              ? parseInt(draft.timeLimitSeconds, 10)
              : draft.timeLimitSeconds
            : undefined,
        displayModeOverride: draft.displayModeOverride,
        options: draft.options.map((option, optionIndex) => ({
          text: option.text.trim(),
          pointValue:
            typeof option.pointValue === "string"
              ? parseInt(option.pointValue, 10) || 0
              : option.pointValue,
          orderIndex: optionIndex,
        })),
      })),
    });

    if (res.success) {
      onAdded(res.data);
      setText("");
      setTimerMode("PER_SUB_QUESTION");
      setTimeLimitSeconds(120);
      setSubQuestions([createQuestionDraft(0)]);
    } else {
      setValidationError(res.error?.message ?? "Failed to create passage.");
    }

    setSaving(false);
    return null;
  };

  const [, formAction] = useActionState(createPassageAction, null);

  return (
    <motion.form
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      action={formAction}
      className="mb-8 border-t border-border bg-surface/50 px-5 py-5 md:px-6 md:py-8"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <p className="label text-accent">New Passage</p>
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost px-5 py-3"
        >
          Cancel
        </button>
      </div>

      <label className="block">
        <span className="field-label mb-2 block">Passage Text</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          className="input-field min-h-[8rem] resize-y"
          placeholder="Enter the reading passage…"
        />
      </label>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_9rem]">
        <label className="block">
          <span className="field-label mb-2 block">Timer Mode</span>
          <CustomSelect
            value={timerMode}
            onChange={(v) => setTimerMode(v as PassageTimerMode)}
            options={PASSAGE_TIMER_MODE_OPTIONS}
          />
        </label>

        {timerMode === "ENTIRE_PASSAGE" ? (
          <label className="block">
            <span className="field-label mb-2 block">Shared Timer</span>
            <input
              type="text"
              inputMode="numeric"
              value={timeLimitSeconds}
              onChange={(event) => {
                const val = event.target.value.replace(/[^0-9]/g, "");
                setTimeLimitSeconds(val === "" ? 0 : parseInt(val, 10));
              }}
              className="input-field font-mono tabular-nums"
            />
          </label>
        ) : (
          <div className="flex items-end pb-3">
            <p className="text-xs text-muted">Each question timed separately</p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="label text-muted">Sub-questions</p>
          <button
            type="button"
            onClick={addSubQuestion}
            className="label text-accent transition-colors hover:text-accent-hover"
          >
            + Add
          </button>
        </div>

        <div className="space-y-4">
          {subQuestions.map((draft, index) => (
            <div key={index} className="space-y-2">
              {subQuestions.length > 1 ? (
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => moveSubQuestion(index, -1)}
                    disabled={index === 0}
                    className="label text-muted transition-colors hover:text-accent disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSubQuestion(index, 1)}
                    disabled={index === subQuestions.length - 1}
                    className="label text-muted transition-colors hover:text-accent disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              ) : null}
              <QuestionDraftEditor
                draft={draft}
                title={`Sub-question ${index + 1}`}
                timerLocked={timerMode === "ENTIRE_PASSAGE"}
                showDisplayMode
                onChange={(next) => updateDraft(index, next)}
                onRemove={
                  subQuestions.length > 1
                    ? () => removeSubQuestion(index)
                    : undefined
                }
              />
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
          className="btn-primary px-5 py-3"
        >
          {saving ? "Adding…" : "Add Passage"}
        </button>
      </div>
    </motion.form>
  );
}
