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
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(120);
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
    setSubQuestions((current) => [...current, createQuestionDraft(current.length)]);

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
    if (
      timerMode === "ENTIRE_PASSAGE" &&
      (!Number.isFinite(timeLimitSeconds) || timeLimitSeconds <= 0)
    ) {
      return "One timer for all requires a positive shared timer.";
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
      timeLimitSeconds: timerMode === "ENTIRE_PASSAGE" ? timeLimitSeconds : null,
      subQuestions: subQuestions.map((draft, index) => ({
        text: draft.text.trim(),
        questionType: draft.questionType,
        orderIndex: index,
        timeLimitSeconds:
          timerMode === "PER_SUB_QUESTION" ? draft.timeLimitSeconds : undefined,
        displayModeOverride: draft.displayModeOverride,
        options: draft.options.map((option, optionIndex) => ({
          text: option.text.trim(),
          pointValue: option.pointValue,
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
      className="mb-8 border border-accent/35 bg-surface px-5 py-5 md:px-6 md:py-6"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="label mb-2 text-accent">Add Passage</p>
          <h3 className="text-xl font-bold tracking-tight text-foreground">
            Build a reading block with nested prompts
          </h3>
        </div>
        <button type="button" onClick={onCancel} className="btn-ghost px-5 py-3">
          Cancel
        </button>
      </div>

      <label className="block">
        <span className="field-label mb-2 block">Passage Text</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          className="input-field min-h-[10rem] resize-y"
          placeholder="Read the following paragraph about photosynthesis..."
        />
      </label>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_9rem]">
        <label className="block">
          <span className="field-label mb-2 block">Timer Mode</span>
          <select
            value={timerMode}
            onChange={(event) =>
              setTimerMode(event.target.value as PassageTimerMode)
            }
            className="input-field"
          >
            {PASSAGE_TIMER_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted">
            {
              PASSAGE_TIMER_MODE_OPTIONS.find((option) => option.value === timerMode)
                ?.description
            }
          </p>
        </label>

        {timerMode === "ENTIRE_PASSAGE" ? (
          <label className="block">
            <span className="field-label mb-2 block">Shared Timer</span>
            <input
              type="number"
              min={5}
              value={timeLimitSeconds}
              onChange={(event) => setTimeLimitSeconds(Number(event.target.value))}
              className="input-field font-mono tabular-nums"
            />
          </label>
        ) : (
          <div className="border border-border px-4 py-3">
            <p className="label text-muted">Timing</p>
            <p className="mt-2 text-sm text-muted">
              Each sub-question owns its own timer.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <p className="label text-muted">Sub-questions</p>
            <p className="mt-1 text-sm text-muted">
              Draft the sequence in order. Rearrange before you save.
            </p>
          </div>
          <button
            type="button"
            onClick={addSubQuestion}
            className="label text-accent transition-colors hover:text-accent-hover"
          >
            + Add sub-question
          </button>
        </div>

        <div className="space-y-4">
          {subQuestions.map((draft, index) => (
            <div key={index} className="space-y-3">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => moveSubQuestion(index, -1)}
                  disabled={index === 0}
                  className="label text-muted transition-colors hover:text-accent disabled:opacity-30"
                >
                  Move up
                </button>
                <button
                  type="button"
                  onClick={() => moveSubQuestion(index, 1)}
                  disabled={index === subQuestions.length - 1}
                  className="label text-muted transition-colors hover:text-accent disabled:opacity-30"
                >
                  Move down
                </button>
              </div>
              <QuestionDraftEditor
                draft={draft}
                title={`Sub-question ${index + 1}`}
                timerLocked={timerMode === "ENTIRE_PASSAGE"}
                showDisplayMode
                onChange={(next) => updateDraft(index, next)}
                onRemove={
                  subQuestions.length > 1 ? () => removeSubQuestion(index) : undefined
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
        <button type="submit" disabled={saving} className="btn-primary px-5 py-3">
          {saving ? "Adding..." : "Add Passage"}
        </button>
      </div>
    </motion.form>
  );
}
