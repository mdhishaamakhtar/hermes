"use client";

import {
  DISPLAY_MODE_OPTIONS,
  normalizeOptionsForQuestionType,
  QUESTION_TYPE_OPTIONS,
} from "@/components/quizzes/editor-model";
import CustomSelect from "@/components/ui/CustomSelect";
import type { DisplayMode } from "@/lib/types";
import type { QuestionDraft } from "@/components/quizzes/editor-model";

interface Props {
  draft: QuestionDraft;
  title: string;
  timerLocked?: boolean;
  showDisplayMode?: boolean;
  onChange: (next: QuestionDraft) => void;
  onRemove?: () => void;
}

export default function QuestionDraftEditor({
  draft,
  title,
  timerLocked = false,
  showDisplayMode = false,
  onChange,
  onRemove,
}: Props) {
  const updateOption = (
    optionIndex: number,
    patch: Partial<QuestionDraft["options"][number]>,
  ) =>
    onChange({
      ...draft,
      options: draft.options.map((option, index) =>
        index === optionIndex ? { ...option, ...patch } : option,
      ),
    });

  const addOption = () =>
    onChange({
      ...draft,
      options: [
        ...draft.options,
        { text: "", pointValue: 0, orderIndex: draft.options.length },
      ],
    });

  const removeOption = (optionIndex: number) =>
    onChange({
      ...draft,
      options: draft.options
        .filter((_, index) => index !== optionIndex)
        .map((option, index) => ({ ...option, orderIndex: index })),
    });

  return (
    <div className="py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="label text-accent">{title}</p>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="label text-muted transition-colors hover:text-danger"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_7rem]">
        <label className="block">
          <span className="field-label mb-2 block">Question Text</span>
          <textarea
            value={draft.text}
            onChange={(event) =>
              onChange({ ...draft, text: event.target.value })
            }
            rows={2}
            className="input-field min-h-[5rem] resize-y"
          />
        </label>
        <label className="block">
          <span className="field-label mb-2 block">Timer</span>
          <input
            type="text"
            inputMode="numeric"
            disabled={timerLocked}
            value={draft.timeLimitSeconds}
            onChange={(event) => {
              const val = event.target.value.replace(/[^0-9]/g, "");
              onChange({
                ...draft,
                timeLimitSeconds: val === "" ? 0 : parseInt(val, 10),
              });
            }}
            className="input-field font-mono tabular-nums disabled:opacity-40"
          />
          {timerLocked ? (
            <p className="mt-1 text-[11px] text-muted">Passage timer</p>
          ) : null}
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="field-label mb-2 block">Type</span>
          <CustomSelect
            value={draft.questionType}
            onChange={(v) =>
              onChange({
                ...draft,
                questionType: v as QuestionDraft["questionType"],
                options: normalizeOptionsForQuestionType(
                  v as QuestionDraft["questionType"],
                  draft.options,
                ),
              })
            }
            options={QUESTION_TYPE_OPTIONS}
          />
        </label>
        {showDisplayMode ? (
          <label className="block">
            <span className="field-label mb-2 block">Display Mode</span>
            <CustomSelect
              value={draft.displayModeOverride ?? "INHERIT"}
              onChange={(v) =>
                onChange({
                  ...draft,
                  displayModeOverride:
                    v === "INHERIT" ? null : (v as DisplayMode),
                })
              }
              options={[
                { value: "INHERIT", label: "Inherit from quiz" },
                ...DISPLAY_MODE_OPTIONS,
              ]}
            />
          </label>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
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
          {draft.options.map((option, optionIndex) => (
            <div
              key={optionIndex}
              className="grid items-center gap-3 border border-border px-3 py-2 md:grid-cols-[2.5rem_minmax(0,1fr)_5rem_auto]"
            >
              <span className="label text-foreground/80">
                {String.fromCharCode(65 + optionIndex)}
              </span>
              <input
                value={option.text}
                onChange={(event) =>
                  updateOption(optionIndex, { text: event.target.value })
                }
                className="input-field"
                placeholder={`Option ${optionIndex + 1}`}
              />
              <input
                type="text"
                value={option.pointValue}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw === "-" || raw === "") {
                    updateOption(optionIndex, { pointValue: raw });
                    return;
                  }
                  const parsed = parseInt(raw, 10);
                  if (!isNaN(parsed)) {
                    updateOption(optionIndex, { pointValue: parsed });
                  }
                }}
                className="input-field font-mono tabular-nums"
              />
              <button
                type="button"
                onClick={() => removeOption(optionIndex)}
                disabled={draft.options.length <= 2}
                className="label self-center text-muted transition-colors hover:text-danger disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
