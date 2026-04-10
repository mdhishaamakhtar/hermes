"use client";

import { useActionState, useState } from "react";
import { motion } from "framer-motion";
import { quizzesApi } from "@/lib/apiClient";
import {
  createDefaultOptions,
  DISPLAY_MODE_OPTIONS,
  isNegativeOption,
  isPositiveOption,
  normalizeOptionsForQuestionType,
  QUESTION_TYPE_OPTIONS,
  validateQuestionDraft,
  type QuestionDraftOption,
} from "@/components/quizzes/editor-model";
import CustomSelect from "@/components/ui/CustomSelect";
import type { DisplayMode, Question, QuestionType } from "@/lib/types";

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
  const [qTime, setQTime] = useState<number | string>(30);
  const [questionType, setQuestionType] =
    useState<QuestionType>("SINGLE_SELECT");
  const [displayModeOverride, setDisplayModeOverride] = useState<
    DisplayMode | "INHERIT"
  >("INHERIT");
  const [options, setOptions] = useState<QuestionDraftOption[]>(
    createDefaultOptions("SINGLE_SELECT"),
  );
  const [creating, setCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const setOptionText = (index: number, text: string) =>
    setOptions((current) =>
      current.map((option, currentIndex) =>
        currentIndex === index ? { ...option, text } : option,
      ),
    );

  const setOptionPoints = (index: number, pointValue: number | string) =>
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
      timeLimitSeconds: typeof qTime === "string" ? parseInt(qTime, 10) : qTime,
      displayModeOverride:
        displayModeOverride === "INHERIT" ? null : displayModeOverride,
      options: options.map((option, index) => ({
        text: option.text.trim(),
        pointValue:
          typeof option.pointValue === "string"
            ? parseInt(option.pointValue, 10) || 0
            : option.pointValue,
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
      className="mb-8 border-t border-border bg-surface/50 px-5 py-5 md:px-6 md:py-8"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <p className="label text-accent">New Question</p>
        <div className="flex items-center gap-3">
          <div className="w-40">
            <CustomSelect
              value={questionType}
              onChange={(v) => {
                const nextType = v as QuestionType;
                setQuestionType(nextType);
                setOptions((current) =>
                  normalizeOptionsForQuestionType(nextType, current),
                );
              }}
              options={QUESTION_TYPE_OPTIONS}
            />
          </div>
          <div className="w-40">
            <CustomSelect
              value={displayModeOverride}
              onChange={(v) =>
                setDisplayModeOverride(v as DisplayMode | "INHERIT")
              }
              options={[
                { value: "INHERIT", label: "Inherit" },
                ...DISPLAY_MODE_OPTIONS,
              ]}
              title={`Inherit uses quiz default: ${quizDisplayMode}`}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_7rem]">
        <label className="block">
          <span className="field-label mb-2 block">Question</span>
          <textarea
            value={qText}
            onChange={(event) => setQText(event.target.value)}
            rows={2}
            className="input-field min-h-[5rem] resize-y"
            placeholder="Enter your question text…"
          />
        </label>
        <label className="block">
          <span className="field-label mb-2 block">Timer (s)</span>
          <input
            type="text"
            inputMode="numeric"
            value={qTime}
            onChange={(event) => {
              const val = event.target.value.replace(/[^0-9]/g, "");
              setQTime(val === "" ? 0 : parseInt(val, 10));
            }}
            className="input-field font-mono tabular-nums"
          />
        </label>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="label text-muted">Options</p>
          <button
            type="button"
            onClick={addOption}
            className="label text-accent transition-colors hover:text-accent-hover"
          >
            + Add
          </button>
        </div>

        <div className="space-y-2">
          {options.map((option, index) => {
            const tone = isPositiveOption(option.pointValue)
              ? "border-success/35 text-success"
              : isNegativeOption(option.pointValue)
                ? "border-danger/35 text-danger"
                : "border-border text-muted";

            return (
              <div
                key={index}
                className="grid items-center gap-x-5 gap-y-3 border-b border-border/50 py-3 md:grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_5rem_auto]"
              >
                <div className="flex items-center gap-5 md:contents">
                  <span className="label shrink-0 text-foreground/80">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span
                    className={`inline-flex min-h-[1.25rem] min-w-[1.75rem] shrink-0 items-center justify-center text-[11px] font-medium ${tone}`}
                  >
                    {isPositiveOption(option.pointValue)
                      ? "✓"
                      : isNegativeOption(option.pointValue)
                        ? "–"
                        : "○"}
                  </span>
                </div>
                <input
                  value={option.text}
                  onChange={(event) => setOptionText(index, event.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="input-field min-w-0"
                />
                <input
                  type="text"
                  value={option.pointValue}
                  onChange={(event) => {
                    const raw = event.target.value;
                    // Allow negative sign while typing
                    if (raw === "-" || raw === "") {
                      setOptionPoints(index, raw);
                      return;
                    }
                    const parsed = parseInt(raw, 10);
                    if (!isNaN(parsed)) {
                      setOptionPoints(index, parsed);
                    }
                  }}
                  className="input-field font-mono tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 2}
                  className="label self-center text-muted transition-colors hover:text-danger disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {validationError && (
        <p className="mt-4 text-sm text-danger">{validationError}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={creating}
          className="btn-primary px-5 py-3"
        >
          {creating ? "Adding…" : "Add Question"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost px-5 py-3"
        >
          Cancel
        </button>
      </div>
    </motion.form>
  );
}
