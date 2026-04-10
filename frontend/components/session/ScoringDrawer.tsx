"use client";

import { AnimatePresence, motion } from "framer-motion";
import { enterAnimation } from "@/lib/design-tokens";

export interface CorrectionDraftOption {
  optionId: number;
  text: string;
  orderIndex: number;
  pointValue: number | string;
}

export function ScoringDrawer({
  open,
  questionTitle,
  draftOptions,
  saving,
  error,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  questionTitle: string;
  draftOptions: CorrectionDraftOption[];
  saving: boolean;
  error?: string;
  onClose: () => void;
  onChange: (index: number, value: string) => void;
  onSave: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div {...enterAnimation} className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close scoring editor"
            onClick={onClose}
            className="absolute inset-0 bg-black/55"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-border bg-background shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="border-b border-border px-6 py-5">
                <p className="label mb-2">Edit scoring</p>
                <h3 className="text-xl font-bold leading-snug text-foreground">
                  {questionTitle}
                </h3>
                <p className="mt-3 text-sm text-muted">
                  Positive point values count as correct. Zero or negative
                  values are treated as incorrect for display and scoring.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-4">
                  {draftOptions.map((option, index) => (
                    <label key={option.optionId} className="block">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {option.text}
                        </span>
                        <span className="text-xs text-muted tabular-nums">
                          Option {index + 1}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={option.pointValue}
                        onChange={(event) =>
                          onChange(index, event.target.value)
                        }
                        className="input-field font-mono tabular-nums"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-border px-6 py-5">
                {error ? (
                  <p className="mb-4 text-sm text-danger">{error}</p>
                ) : null}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="border border-border px-5 py-3 text-xs tracking-widest uppercase text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? "Saving..." : "Save & Recalculate"}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
