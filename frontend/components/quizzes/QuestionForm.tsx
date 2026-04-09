"use client";

import { useActionState, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { quizzesApi } from "@/lib/apiClient";
import {
  createDefaultOptions,
  DISPLAY_MODE_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  validateQuestionDraft,
} from "@/components/quizzes/editor-model";
import type {
  DisplayMode,
  Question,
  QuestionOptionInput,
  QuestionType,
} from "@/lib/types";

interface Props {
  quizId: string;
  nextOrderIndex: number;
  quizDisplayMode: DisplayMode;
  onAdded: (question: Question) => void;
  onCancel: () => void;
}

export default function QuestionForm({
  quizId,
  nextOrderIndex,
  quizDisplayMode,
  onAdded,
  onCancel,
}: Props) {
  const [qText, setQText] = useState("");
  const [qTime, setQTime] = useState(30);
  const [questionType, setQuestionType] =
    useState<QuestionType>("SINGLE_SELECT");
  const [displayModeOverride, setDisplayModeOverride] =
    useState<DisplayMode | "INHERIT">("INHERIT");
  const [options, setOptions] = useState<QuestionOptionInput[]>(
    createDefaultOptions("SINGLE_SELECT"),
  );
  const [creating, setCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setOptions(createDefaultOptions(questionType));
  }, [questionType]);

  const setOptionText = (index: number, text: string) =>
    setOptions((current) =>
      current.map((option, currentIndex) =>
        currentIndex === index ? { ...option, text } : option,
      ),
    );

  const setOptionPoints = (index: number, pointValue: number) =>
    setOptions((current) =>
      current.map((option, currentIndex) =>
        currentIndex === index ? { ...option, pointValue } : option,
      ),
    );

  const addOption = () =>
    setOptions((current) => [
      ...current,
      { text: "", pointValue: 0, orderIndex: current.length },
    ]);

  const removeOption = (index: number) =>
    setOptions((current) =>
      current
        .filter((_, currentIndex) => currentIndex !== index)
        .map((option, currentIndex) => ({
          ...option,
          orderIndex: currentIndex,
        })),
    );

  const validate = () => {
    return validateQuestionDraft({
      text: qText,
      timeLimitSeconds: qTime,
      questionType,
      options,
    });
  };

  const addQuestionAction = async () => {
    const error = validate();
    if (error) {
      setValidationError(error);
      return null;
    }

    setValidationError(null);
    setCreating(true);

    const res = await quizzesApi.createQuestion(quizId, {
      text: qText.trim(),
      questionType,
      orderIndex: nextOrderIndex,
      timeLimitSeconds: qTime,
      displayModeOverride:
        displayModeOverride === "INHERIT" ? null : displayModeOverride,
      options: options.map((option, index) => ({
        text: option.text.trim(),
        pointValue: option.pointValue,
        orderIndex: index,
      })),
    });

    if (res.success) {
      onAdded(res.data);
      setQText("");
      setQTime(30);
      setQuestionType("SINGLE_SELECT");
      setDisplayModeOverride("INHERIT");
      setOptions(createDefaultOptions("SINGLE_SELECT"));
    } else {
      setValidationError(res.error?.message ?? "Failed to add question.");
    }

    setCreating(false);
    return null;
  };

  const [, formAction] = useActionState(addQuestionAction, null);

  return (
    <motion.form
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      action={formAction}
      className="mb-8 border border-primary/35 bg-surface px-5 py-5 md:px-6 md:py-6"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="label mb-2 text-accent">Add Standalone Question</p>
          <h3 className="text-xl font-bold tracking-tight text-foreground">
            Fast prompt, tuned scoring, stage-ready defaults
          </h3>
        </div>
        <div className="grid min-w-[16rem] gap-3 text-right md:grid-cols-2 md:text-left">
          <label className="block">
            <span className="field-label mb-2 block">Question Type</span>
            <select
              value={questionType}
              onChange={(event) =>
                setQuestionType(event.target.value as QuestionType)
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
              value={displayModeOverride}
              onChange={(event) =>
                setDisplayModeOverride(
                  event.target.value as DisplayMode | "INHERIT",
                )
              }
              className="input-field"
              title={`Inherit uses quiz default: ${quizDisplayMode}`}
            >
              <option value="INHERIT">Inherit quiz default</option>
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
            value={qText}
            onChange={(event) => setQText(event.target.value)}
            rows={3}
            className="input-field min-h-[7rem] resize-y"
            placeholder="Select all prime numbers with confidence."
          />
        </label>
        <label className="block">
          <span className="field-label mb-2 block">Timer</span>
          <input
            type="number"
            min={5}
            value={qTime}
            onChange={(event) => setQTime(Number(event.target.value))}
            className="input-field font-mono tabular-nums"
          />
          <p className="mt-2 text-xs text-muted">Seconds per question.</p>
        </label>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <p className="label text-muted">Options + scoring</p>
            <p className="mt-1 text-sm text-muted">
              Positive scores reveal the right path. Zero stays neutral. Negative
              values punish trap picks.
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
          {options.map((option, index) => {
            const tone =
              option.pointValue > 0
                ? "border-success/35 text-success"
                : option.pointValue < 0
                  ? "border-danger/35 text-danger"
                  : "border-border text-muted";

            return (
              <div
                key={index}
                className="grid gap-3 border border-border px-4 py-3 md:grid-cols-[3rem_minmax(0,1fr)_7rem_auto]"
              >
                <div className="flex items-center justify-between md:block">
                  <span className="label text-foreground/80">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className={`text-xs font-medium ${tone}`}>
                    {option.pointValue > 0
                      ? "Positive"
                      : option.pointValue < 0
                        ? "Penalty"
                        : "Neutral"}
                  </span>
                </div>
                <input
                  value={option.text}
                  onChange={(event) => setOptionText(index, event.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="input-field"
                />
                <label className="block">
                  <span className="field-label mb-2 block md:hidden">Points</span>
                  <input
                    type="number"
                    value={option.pointValue}
                    onChange={(event) =>
                      setOptionPoints(index, Number(event.target.value))
                    }
                    className="input-field font-mono tabular-nums"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 2}
                  className="label self-center text-muted transition-colors hover:text-danger disabled:opacity-30"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {validationError && (
        <p className="mt-4 text-sm text-danger">{validationError}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={creating} className="btn-primary px-5 py-3">
          {creating ? "Adding..." : "Add Question"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost px-5 py-3">
          Cancel
        </button>
      </div>
    </motion.form>
  );
}
