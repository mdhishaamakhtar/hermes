"use client";

import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { questionsApi } from "@/lib/apiClient";
import type { Question, OptionReq } from "@/lib/types";

interface Props {
  question: Question;
  index: number;
  disabled: boolean;
  onDelete: (id: number) => void;
  onSaved: (updated: Question) => void;
  onEditOpen: () => void;
}

export default function QuestionCard({
  question,
  index,
  disabled,
  onDelete,
  onSaved,
  onEditOpen,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editTime, setEditTime] = useState(30);
  const [editOptions, setEditOptions] = useState<OptionReq[]>([]);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const openEdit = () => {
    setEditText(question.text);
    setEditTime(question.timeLimitSeconds);
    setEditOptions(
      question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
    );
    setValidationError(null);
    setIsEditing(true);
    onEditOpen();
  };

  const setEditCorrect = (idx: number) =>
    setEditOptions((current) =>
      current.map((option, index) => ({ ...option, isCorrect: index === idx })),
    );

  const saveEditAction = async () => {
    if (!editOptions.some((o) => o.isCorrect)) {
      setValidationError("Mark one option as correct.");
      return null;
    }
    if (editOptions.some((o) => !o.text.trim())) {
      setValidationError("Fill in all option texts.");
      return null;
    }
    setValidationError(null);

    setSaving(true);
    const res = await questionsApi.update(question.id, {
      text: editText,
      orderIndex: question.orderIndex,
      timeLimitSeconds: editTime,
      options: editOptions,
    });

    if (res.success) {
      onSaved(res.data);
      setIsEditing(false);
    }

    setSaving(false);
    return null;
  };

  const [, saveFormAction] = useActionState(saveEditAction, null);

  return (
    <AnimatePresence mode="wait" initial>
      {!isEditing ? (
        <motion.div
          key="view"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.15, delay: index * 0.04 }}
          className="border border-border bg-surface p-6"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3">
              <span className="font-mono text-xs text-muted mt-0.5 tabular-nums">
                {question.orderIndex}.
              </span>
              <div>
                <p className="text-foreground text-base font-medium">
                  {question.text}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {question.timeLimitSeconds}s
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={openEdit}
                disabled={disabled}
                className="label text-muted/40 hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:opacity-100"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(question.id)}
                disabled={disabled}
                className="label text-muted/40 hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:opacity-100"
              >
                Delete
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 ml-6">
            {question.options.map((option) => (
              <div
                key={option.id}
                className={`px-3 py-1.5 text-xs border ${
                  option.isCorrect
                    ? "border-success/40 text-success bg-success/5"
                    : "border-border text-muted"
                }`}
              >
                {option.text}
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.form
          key="edit"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          action={saveFormAction}
          className="border border-warning/40 bg-surface p-6 space-y-4"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs tracking-widest uppercase text-warning">
              Editing Q{question.orderIndex}
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="label hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="field-label block mb-2">Question Text</label>
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                required
                className="input-field"
              />
            </div>
            <div className="w-28">
              <label className="field-label block mb-2">Time (s)</label>
              <input
                type="number"
                value={editTime}
                onChange={(e) => setEditTime(Number(e.target.value))}
                min={5}
                className="input-field font-mono"
              />
            </div>
          </div>

          <div>
            <label className="field-label block mb-3">
              Options{" "}
              <span className="text-muted/50">(click to mark correct)</span>
            </label>
            <div className="space-y-2">
              {editOptions.map((option, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditCorrect(idx)}
                    className={`w-4 h-4 border shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success ${
                      option.isCorrect
                        ? "bg-success border-success"
                        : "border-border hover:border-success/50"
                    }`}
                    aria-label={`Mark option ${idx + 1} as correct`}
                  />
                  <input
                    value={option.text}
                    onChange={(e) =>
                      setEditOptions((current) =>
                        current.map((item, i) =>
                          i === idx ? { ...item, text: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder={`Option ${idx + 1}`}
                    className="input-field"
                  />
                </div>
              ))}
            </div>
            {validationError && (
              <p className="text-xs text-danger mt-2">{validationError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-warning text-white px-5 py-2 text-sm tracking-widest uppercase hover:bg-warning-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
