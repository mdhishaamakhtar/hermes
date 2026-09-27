"use client";

import { useId, useState, type CSSProperties, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { describeError } from "@/lib/api";
import { optionColor, optionLetter } from "@/lib/options";

export interface ScoringTarget {
  questionId: number;
  number: number;
  text: string;
  options: Array<{ id: number; text: string; pointValue: number }>;
}

/**
 * Re-score a graded question. Saving recalculates every player's total on
 * the server; the leaderboard updates the moment it lands.
 */
export function ScoringDrawer({
  open,
  target,
  onClose,
  onSave,
}: {
  open: boolean;
  /** Kept after closing so the drawer does not blank while it slides out. */
  target: ScoringTarget | null;
  onClose: () => void;
  onSave: (
    questionId: number,
    points: Array<{ optionId: number; pointValue: number }>,
  ) => Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="drawer"
      title={target ? `Scoring for question ${target.number}` : "Scoring"}
      description={target?.text}
    >
      {target && (
        <ScoringForm
          key={target.questionId}
          target={target}
          onCancel={onClose}
          onSave={async (points) => {
            await onSave(target.questionId, points);
            onClose();
          }}
        />
      )}
    </Dialog>
  );
}

function ScoringForm({
  target,
  onSave,
  onCancel,
}: {
  target: ScoringTarget;
  onSave: (
    points: Array<{ optionId: number; pointValue: number }>,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const formId = useId();
  const [points, setPoints] = useState(() =>
    target.options.map((option) => String(option.pointValue)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (points.some((value) => !/^-?\d+$/.test(value))) {
      setError("Every option needs a whole number of points.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave(
        target.options.map((option, index) => ({
          optionId: option.id,
          pointValue: Number.parseInt(points[index], 10),
        })),
      );
    } catch (err) {
      setError(describeError(err, "Couldn't update the scoring."));
      setPending(false);
    }
  };

  return (
    <form id={formId} onSubmit={submit} className="flex h-full flex-col gap-5">
      <p className="text-sm text-muted">
        Options with positive points count as correct. Everyone&apos;s score is
        recalculated when you save.
      </p>
      <ol className="flex flex-col gap-2">
        {target.options.map((option, index) => {
          const value = Number.parseInt(points[index], 10);
          return (
            <li
              key={option.id}
              className="option-tile"
              data-state={value > 0 ? "correct" : undefined}
              style={{ "--option": optionColor(index) } as CSSProperties}
            >
              <span className="option-letter">{optionLetter(index)}</span>
              <label
                htmlFor={`${formId}-${option.id}`}
                className="min-w-0 text-sm break-words text-foreground"
              >
                {option.text}
              </label>
              <div className="relative w-24">
                <input
                  id={`${formId}-${option.id}`}
                  value={points[index]}
                  inputMode="numeric"
                  data-autofocus={index === 0 || undefined}
                  // Typing replaces the old value instead of joining it.
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (!/^-?\d*$/.test(raw)) return;
                    setPoints((current) =>
                      current.map((entry, i) => (i === index ? raw : entry)),
                    );
                  }}
                  className="input pr-10 text-right font-mono tabular-nums"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs text-subtle"
                >
                  pts
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {error && <Alert>{error}</Alert>}
      <div className="mt-auto flex flex-wrap justify-end gap-3 border-t border-border pt-5">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" pending={pending}>
          {pending ? "Recalculating…" : "Save and recalculate"}
        </Button>
      </div>
    </form>
  );
}
