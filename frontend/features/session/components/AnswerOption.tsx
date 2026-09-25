"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { spring } from "@/lib/motion";
import { optionColor, optionLetter } from "@/lib/options";

export type OptionState =
  "selected" | "correct" | "missed" | "wrong" | "dimmed";

const SCREEN_READER_STATE: Partial<Record<OptionState, string>> = {
  selected: "Your pick",
  correct: "Correct answer",
  missed: "Correct answer, not picked",
  wrong: "Your pick, incorrect",
};

interface AnswerOptionProps {
  index: number;
  text: string;
  state?: OptionState;
  /** Share of responses, 0 to 1, drawn as a fill behind the text. */
  share?: number;
  /** Right-hand detail: a count, points, or a status mark. */
  aside?: ReactNode;
  size?: "md" | "lg";
  /** Makes the tile a toggle the player presses to choose it. */
  onPress?: () => void;
  disabled?: boolean;
  /** Multi-select tiles behave as checkboxes, single-select as radios. */
  role?: "radio" | "checkbox";
}

/**
 * An answer, in any context: the host's stage, a player's phone, results.
 * The letter and colour are the option's identity; `state` says what it
 * means right now. The response fill springs to its share as answers land.
 */
export function AnswerOption({
  index,
  text,
  state,
  share,
  aside,
  size = "md",
  onPress,
  disabled = false,
  role,
}: AnswerOptionProps) {
  const style = { "--option": optionColor(index) } as CSSProperties;
  const marked = state === "correct" || state === "missed";
  const content = (
    <>
      {share !== undefined && (
        <motion.span
          aria-hidden
          className="absolute inset-0 origin-left"
          style={{
            backgroundColor: "color-mix(in srgb, var(--tone) 16%, transparent)",
          }}
          initial={false}
          animate={{ scaleX: Math.min(1, Math.max(0, share)) }}
          transition={spring.bar}
        />
      )}
      <span
        className={`option-letter relative ${size === "lg" ? "size-9 text-sm" : ""}`}
      >
        {marked || state === "wrong" ? (
          <Icon name={state === "wrong" ? "close" : "check"} size={14} />
        ) : (
          optionLetter(index)
        )}
      </span>
      <span
        className={`relative min-w-0 break-words whitespace-pre-wrap text-foreground ${
          size === "lg"
            ? "text-lg leading-snug font-medium"
            : "text-base leading-snug"
        }`}
      >
        {state && SCREEN_READER_STATE[state] && (
          <span className="sr-only">{SCREEN_READER_STATE[state]}: </span>
        )}
        {text}
      </span>
      {aside !== undefined ? (
        <span className="relative flex items-center gap-3 font-mono text-sm text-muted tabular-nums">
          {aside}
        </span>
      ) : (
        <span />
      )}
    </>
  );

  const className = `option-tile overflow-hidden ${size === "lg" ? "min-h-16 px-4 py-4" : ""}`;

  if (onPress) {
    return (
      <button
        type="button"
        role={role}
        aria-checked={role ? state === "selected" : undefined}
        onClick={onPress}
        disabled={disabled}
        data-state={state}
        className={`${className} w-full active:scale-[0.99] disabled:cursor-default`}
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <div data-state={state} className={className} style={style}>
      {content}
    </div>
  );
}
