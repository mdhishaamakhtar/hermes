"use client";

import { useId, useState, type CSSProperties, type FormEvent } from "react";
import { motion } from "motion/react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import {
  SegmentedControl,
  type Segment,
} from "@/components/ui/SegmentedControl";
import { describeError } from "@/lib/api";
import { rise } from "@/lib/motion";
import { optionColor, optionLetter } from "@/lib/options";
import type { DisplayMode, QuestionType } from "@/lib/types";
import {
  DISPLAY_MODES,
  isCorrect,
  MIN_OPTIONS,
  QUESTION_TYPES,
  toggleCorrect,
  validateQuestion,
  withQuestionType,
  type QuestionDraft,
} from "./editor-model";

type DisplayChoice = DisplayMode | "QUIZ_DEFAULT";

/**
 * The fields of one question, controlled. Used on its own by the passage
 * composer, where several drafts save together, and inside QuestionEditor
 * everywhere else.
 */
export function QuestionFields({
  draft,
  onChange,
  ownTimer,
  quizDisplayMode,
  autoFocus = true,
}: {
  draft: QuestionDraft;
  onChange: (next: QuestionDraft) => void;
  /** False under a passage's shared timer, where the question has none. */
  ownTimer: boolean;
  quizDisplayMode: DisplayMode;
  /** Off where another field on the form should take focus first. */
  autoFocus?: boolean;
}) {
  const typeId = useId();
  const displayId = useId();
  const displayChoices: Segment<DisplayChoice>[] = [
    {
      value: "QUIZ_DEFAULT",
      label: "Default",
      description: `Uses the quiz setting, currently ${DISPLAY_MODES.find(
        (mode) => mode.value === quizDisplayMode,
      )?.label.toLowerCase()}.`,
    },
    ...DISPLAY_MODES,
  ];

  return (
    <div className="flex flex-col gap-6">
      <div
        className={`grid gap-5 ${ownTimer ? "sm:grid-cols-[minmax(0,1fr)_8rem]" : ""}`}
      >
        <TextAreaField
          label="Question"
          value={draft.text}
          onChange={(event) => onChange({ ...draft, text: event.target.value })}
          rows={2}
          placeholder="What do you want to ask?"
          className="min-h-20 text-lg leading-snug font-semibold"
          autoFocus={autoFocus}
        />
        {ownTimer && (
          <TextField
            label="Timer"
            suffix="sec"
            inputMode="numeric"
            value={draft.timeLimitSeconds}
            onChange={(event) =>
              onChange({
                ...draft,
                timeLimitSeconds: event.target.value.replace(/\D/g, ""),
              })
            }
            className="font-mono tabular-nums"
          />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field id={typeId} label="Answers">
          <SegmentedControl<QuestionType>
            id={typeId}
            value={draft.questionType}
            options={QUESTION_TYPES}
            onChange={(questionType) =>
              onChange(withQuestionType(draft, questionType))
            }
          />
        </Field>
        <Field id={displayId} label="Answer display">
          <SegmentedControl<DisplayChoice>
            id={displayId}
            value={draft.displayModeOverride ?? "QUIZ_DEFAULT"}
            options={displayChoices}
            onChange={(choice) =>
              onChange({
                ...draft,
                displayModeOverride: choice === "QUIZ_DEFAULT" ? null : choice,
              })
            }
          />
        </Field>
      </div>

      <OptionsEditor draft={draft} onChange={onChange} />
    </div>
  );
}

function OptionsEditor({
  draft,
  onChange,
}: {
  draft: QuestionDraft;
  onChange: (next: QuestionDraft) => void;
}) {
  const setOption = (
    index: number,
    patch: Partial<QuestionDraft["options"][number]>,
  ) =>
    onChange({
      ...draft,
      options: draft.options.map((option, i) =>
        i === index ? { ...option, ...patch } : option,
      ),
    });

  return (
    <fieldset className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <legend className="text-sm font-medium text-muted">Options</legend>
        <p className="text-sm text-subtle">
          Tap a letter to mark it correct. Negative points penalise a wrong
          pick.
        </p>
      </div>

      <ol className="flex flex-col gap-2">
        {draft.options.map((option, index) => {
          const correct = isCorrect(option);
          const letter = optionLetter(index);
          return (
            <li
              key={index}
              className="option-tile items-start gap-y-2 px-3 py-3"
              data-state={correct ? "correct" : undefined}
              style={{ "--option": optionColor(index) } as CSSProperties}
            >
              <button
                type="button"
                onClick={() => onChange(toggleCorrect(draft, index))}
                aria-pressed={correct}
                aria-label={
                  correct
                    ? `Option ${letter} is correct. Unmark it`
                    : `Mark option ${letter} correct`
                }
                title={correct ? "Correct answer" : "Mark correct"}
                className="option-letter mt-1.5 size-8 transition-transform hover:scale-105"
              >
                {correct ? <Icon name="check" size={14} /> : letter}
              </button>
              <textarea
                value={option.text}
                onChange={(event) =>
                  setOption(index, { text: event.target.value })
                }
                rows={1}
                placeholder={`Option ${letter}`}
                aria-label={`Option ${letter} text`}
                className="input min-h-11 py-2.5"
              />
              <div className="flex items-start gap-1">
                <div className="relative w-24">
                  <input
                    value={option.points}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (/^-?\d*$/.test(raw))
                        setOption(index, { points: raw });
                    }}
                    inputMode="numeric"
                    aria-label={`Option ${letter} points`}
                    className={`input pr-10 text-right font-mono tabular-nums ${
                      correct
                        ? "text-success"
                        : Number(option.points) < 0
                          ? "text-danger"
                          : ""
                    }`}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs text-subtle"
                  >
                    pts
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="close"
                  aria-label={`Remove option ${letter}`}
                  disabled={draft.options.length <= MIN_OPTIONS}
                  onClick={() =>
                    onChange({
                      ...draft,
                      options: draft.options.filter((_, i) => i !== index),
                    })
                  }
                  className="mt-1 hover:text-danger"
                />
              </div>
            </li>
          );
        })}
      </ol>

      <div>
        <Button
          variant="ghost"
          size="sm"
          icon="plus"
          onClick={() =>
            onChange({
              ...draft,
              options: [...draft.options, { text: "", points: "0" }],
            })
          }
        >
          Add option
        </Button>
      </div>
    </fieldset>
  );
}

/**
 * A question in its own form: new standalone questions, edits, and new
 * sub-questions of a saved passage. Validation runs before anything is sent;
 * a server refusal keeps the draft and shows the reason above the buttons.
 */
export function QuestionEditor({
  heading,
  initial,
  ownTimer,
  quizDisplayMode,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  heading: string;
  initial: QuestionDraft;
  ownTimer: boolean;
  quizDisplayMode: DisplayMode;
  submitLabel: string;
  onSubmit: (draft: QuestionDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const headingId = useId();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = validateQuestion(draft, { ownTimer });
    if (invalid) {
      setError(invalid);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit(draft);
    } catch (err) {
      setError(describeError(err, "Couldn't save the question."));
      setPending(false);
    }
  };

  return (
    <motion.form
      {...rise}
      onSubmit={submit}
      aria-labelledby={headingId}
      className="border border-primary/40 bg-surface p-5 sm:p-6"
    >
      <h3
        id={headingId}
        className="mb-5 text-base font-semibold text-foreground"
      >
        {heading}
      </h3>
      <QuestionFields
        draft={draft}
        onChange={(next) => {
          setDraft(next);
          if (error) setError(null);
        }}
        ownTimer={ownTimer}
        quizDisplayMode={quizDisplayMode}
      />
      {error && <Alert className="mt-6">{error}</Alert>}
      <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
        <Button type="submit" variant="primary" pending={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </motion.form>
  );
}
