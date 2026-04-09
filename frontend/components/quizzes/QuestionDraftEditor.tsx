"use client";

import {
  DISPLAY_MODE_OPTIONS,
  normalizeOptionsForQuestionType,
  QUESTION_TYPE_OPTIONS,
} from "@/components/quizzes/editor-model";
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
    <div className="border border-border/80 bg-background/40 px-4 py-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="label text-accent">{title}</p>
          <p className="mt-1 text-xs text-muted">
            Shape the prompt, then tune the scoring grid.
          </p>
        </div>
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
            onChange={(event) => onChange({ ...draft, text: event.target.value })}
            rows={3}
            className="input-field min-h-[6rem] resize-y"
          />
        </label>
        <label className="block">
          <span className="field-label mb-2 block">Timer</span>
          <input
            type="number"
            min={timerLocked ? 0 : 5}
            disabled={timerLocked}
            value={draft.timeLimitSeconds}
            onChange={(event) =>
              onChange({
                ...draft,
                timeLimitSeconds: Number(event.target.value),
              })
            }
            className="input-field font-mono tabular-nums disabled:opacity-40"
          />
          <p className="mt-2 text-xs text-muted">
            {timerLocked ? "Shared with the passage timer." : "Seconds for this sub-question."}
          </p>
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="field-label mb-2 block">Question Type</span>
          <select
            value={draft.questionType}
            onChange={(event) =>
              onChange({
                ...draft,
                questionType: event.target.value as QuestionDraft["questionType"],
                options: normalizeOptionsForQuestionType(
                  event.target.value as QuestionDraft["questionType"],
                  draft.options,
                ),
              })
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
        {showDisplayMode ? (
          <label className="block">
            <span className="field-label mb-2 block">Display Mode</span>
            <select
              value={draft.displayModeOverride ?? "INHERIT"}
              onChange={(event) =>
                onChange({
                  ...draft,
                  displayModeOverride:
                    event.target.value === "INHERIT"
                      ? null
                      : (event.target.value as DisplayMode),
                })
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
        ) : null}
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="label text-muted">Options</p>
          <button
            type="button"
            onClick={addOption}
            className="label text-accent transition-colors hover:text-accent-hover"
          >
            + Add option
          </button>
        </div>

        <div className="space-y-3">
          {draft.options.map((option, optionIndex) => (
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
                  updateOption(optionIndex, { text: event.target.value })
                }
                className="input-field"
                placeholder={`Option ${optionIndex + 1}`}
              />
              <input
                type="number"
                value={option.pointValue}
                onChange={(event) =>
                  updateOption(optionIndex, { pointValue: Number(event.target.value) })
                }
                className="input-field font-mono tabular-nums"
              />
              <button
                type="button"
                onClick={() => removeOption(optionIndex)}
                disabled={draft.options.length <= 2}
                className="label self-center text-muted transition-colors hover:text-danger disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
