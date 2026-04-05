"use client";

import { useActionState, useState } from "react";
import { motion } from "framer-motion";
import { quizzesApi } from "@/lib/apiClient";
import type { Question, OptionReq } from "@/lib/types";

const EMPTY_OPTIONS: OptionReq[] = [
  { text: "", isCorrect: true },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

interface Props {
  quizId: string;
  nextOrderIndex: number;
  onAdded: (question: Question) => void;
  onCancel: () => void;
}

export default function QuestionForm({
  quizId,
  nextOrderIndex,
  onAdded,
  onCancel,
}: Props) {
  const [qText, setQText] = useState("");
  const [qTime, setQTime] = useState(30);
  const [options, setOptions] = useState<OptionReq[]>(EMPTY_OPTIONS);
  const [creating, setCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const setCorrect = (idx: number) =>
    setOptions((current) =>
      current.map((option, index) => ({ ...option, isCorrect: index === idx })),
    );

  const addQuestionAction = async (_prev: null, formData: FormData) => {
    const text = formData.get("qText") as string;
    const time = Number(formData.get("qTime"));

    if (!options.some((o) => o.isCorrect)) {
      setValidationError("Mark one option as correct.");
      return null;
    }
    if (options.some((o) => !o.text.trim())) {
      setValidationError("Fill in all option texts.");
      return null;
    }
    setValidationError(null);

    setCreating(true);
    const res = await quizzesApi.createQuestion(quizId, {
      text,
      orderIndex: nextOrderIndex,
      timeLimitSeconds: time,
      options,
    });

    if (res.success) {
      onAdded(res.data);
      setQText("");
      setQTime(30);
      setOptions(EMPTY_OPTIONS);
    }

    setCreating(false);
    return null;
  };

  const [, formAction] = useActionState(addQuestionAction, null);

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      action={formAction}
      className="mb-6 border border-primary/40 bg-surface p-6 space-y-4"
    >
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="field-label block mb-2">Question Text</label>
          <input
            name="qText"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            required
            className="input-field"
            placeholder="What is..."
          />
        </div>
        <div className="w-28">
          <label className="field-label block mb-2">Time (s)</label>
          <input
            type="number"
            name="qTime"
            value={qTime}
            onChange={(e) => setQTime(Number(e.target.value))}
            min={5}
            className="input-field font-mono"
          />
        </div>
      </div>

      <div>
        <label className="field-label block mb-3">
          Options <span className="text-muted/50">(click to mark correct)</span>
        </label>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCorrect(index)}
                className={`w-4 h-4 border shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success ${
                  option.isCorrect
                    ? "bg-success border-success"
                    : "border-border hover:border-success/50"
                }`}
                aria-label={`Mark option ${index + 1} as correct`}
              />
              <input
                value={option.text}
                onChange={(e) =>
                  setOptions((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, text: e.target.value } : item,
                    ),
                  )
                }
                placeholder={`Option ${index + 1}`}
                className="input-field"
              />
            </div>
          ))}
        </div>
        {validationError && (
          <p className="text-xs text-danger mt-2">{validationError}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={creating}
          className="bg-primary text-white px-5 py-2 text-sm tracking-widest uppercase hover:bg-primary-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {creating ? "Adding..." : "Add Question"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="label text-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Cancel
        </button>
      </div>
    </motion.form>
  );
}
