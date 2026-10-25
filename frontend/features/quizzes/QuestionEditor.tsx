"use client";

import { useId, useState, type CSSProperties, type FormEvent } from "react";
import { motion } from "motion/react";
import { useUnsavedChanges } from "@/components/LeaveGuard";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import {
  SegmentedControl,
  type Segment,
} from "@/components/ui/SegmentedControl";
import { describeError } from "@/lib/api";
import { fade, rise } from "@/lib/motion";
import { optionColor, optionLetter } from "@/lib/options";
import type { DisplayMode, QuestionType } from "@/lib/types";
import {
  DISPLAY_MODES,
  displayChoice,
  displayModeLabel,
  isCorrect,
  MIN_OPTIONS,
  QUESTION_TYPES,
  sameDraft,
  scoringSummary,
  toggleCorrect,
  usesCustomScoring,
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
  const detailsId = useId();
  // Folded away until wanted, unless this question already uses them.
  const [details, setDetails] = useState(() => usesCustomScoring(draft));
  const displayChoices: Segment<DisplayChoice>[] = [
    {
      value: "QUIZ_DEFAULT",
      label: "Quiz default",
      description: `Follows the quiz: ${displayModeLabel(quizDisplayMode).toLowerCase()}.`,
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

      <Field id={typeId} label="Answers">
        <div className="max-w-md">
          <SegmentedControl<QuestionType>
            id={typeId}
            value={draft.questionType}
            options={QUESTION_TYPES}
            onChange={(questionType) =>
              onChange(withQuestionType(draft, questionType))
            }
          />
        </div>
      </Field>

      <OptionsEditor draft={draft} onChange={onChange} showPoints={details} />

      <div className="border-t border-border pt-4">
        <button
          type="button"
          aria-expanded={details}
          aria-controls={detailsId}
          onClick={() => setDetails((open) => !open)}
          className="flex w-full items-center justify-between gap-4 text-left text-sm"
        >
          <span className="font-medium text-foreground">Points & display</span>
          <span className="flex items-center gap-2 text-subtle">
            {!details && scoringSummary(draft)}
            <Icon
              name="chevron-down"
              size={16}
              className={`transition-transform duration-(--duration-base) ${details ? "rotate-180" : ""}`}
            />
          </span>
        </button>
        {details && (
          <motion.div
            id={detailsId}
            {...fade}
            className="mt-5 flex flex-col gap-5"
          >
            <p className="text-sm text-muted">
              Set each option&apos;s points beside it above. A negative value
              takes points away for a wrong pick.
            </p>
            <Field id={displayId} label="Answer display on the big screen">
              <div className="max-w-md">
                <SegmentedControl<DisplayChoice>
                  id={displayId}
                  value={
                    draft.displayModeOverride
                      ? displayChoice(draft.displayModeOverride)
                      : "QUIZ_DEFAULT"
                  }
                  options={displayChoices}
                  onChange={(choice) =>
                    onChange({
                      ...draft,
                      displayModeOverride:
                        choice === "QUIZ_DEFAULT" ? null : choice,
                    })
                  }
                />
              </div>
            </Field>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function OptionsEditor({
  draft,
  onChange,
  showPoints,
}: {
  draft: QuestionDraft;
  onChange: (next: QuestionDraft) => void;
  /** Each option's points, shown when the author opens scoring. */
  showPoints: boolean;
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
          Tap a letter to mark the right answer.
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
                {showPoints && (
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
                )}
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
          className="ghost-flush-start"
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
 * Cancelling with changes asks first, and so does leaving the page.
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
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = !sameDraft(draft, initial);
  useUnsavedChanges(dirty && !pending);

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

  const cancel = () => (dirty ? setConfirmDiscard(true) : onCancel());

  return (
    <motion.form
      {...rise}
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !confirmDiscard) cancel();
      }}
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
        <Button variant="ghost" onClick={cancel} disabled={pending}>
          Cancel
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard your changes?"
        description="What you've written here won't be saved."
        confirmLabel="Discard"
        onConfirm={onCancel}
      />
    </motion.form>
  );
}
