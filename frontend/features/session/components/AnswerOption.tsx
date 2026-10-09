"use client";

import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon, type IconName } from "@/components/ui/Icon";
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
  /** `xl` is the host's projector size, for a lone question on the stage. */
  size?: "md" | "lg" | "xl";
  /** The player committed to this pick; the letter becomes a lock. */
  locked?: boolean;
  /** Makes the tile a toggle the player presses to choose it. */
  onPress?: () => void;
  disabled?: boolean;
  /** Multi-select tiles behave as checkboxes, single-select as radios. */
  role?: "radio" | "checkbox";
}

const LETTER_SIZE = { md: "", lg: "size-9 text-sm", xl: "size-11 text-base" };
const TEXT_SIZE = {
  md: "text-base leading-snug",
  lg: "text-lg leading-snug font-medium",
  xl: "text-xl leading-snug font-medium xl:text-2xl",
};
const TILE_SIZE = {
  md: "",
  lg: "min-h-16 px-4 py-4",
  xl: "min-h-20 gap-x-4 px-5 py-5",
};

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
  locked = false,
  onPress,
  disabled = false,
  role,
}: AnswerOptionProps) {
  const style = { "--option": optionColor(index) } as CSSProperties;
  const marked = state === "correct" || state === "missed";
  const glyph: IconName | null =
    state === "wrong"
      ? "close"
      : marked
        ? "check"
        : locked && state === "selected"
          ? "lock"
          : null;
  const content = (
    <>
      {share !== undefined && (
        <motion.span
          aria-hidden
          className="absolute inset-0 origin-left"
          style={{
            backgroundColor: "color-mix(in srgb, var(--tone) 22%, transparent)",
          }}
          initial={false}
          animate={{ scaleX: Math.min(1, Math.max(0, share)) }}
          transition={spring.bar}
        />
      )}
      <span
        className={`option-letter relative overflow-hidden ${LETTER_SIZE[size]}`}
      >
        {/* The mark stamps in when the tile's meaning changes: a lock on
            commit, a tick or cross on the reveal. */}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={glyph ?? "letter"}
            className="inline-grid place-items-center"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
            transition={spring.stamp}
          >
            {glyph ? (
              <Icon name={glyph} size={size === "md" ? 14 : 16} />
            ) : (
              optionLetter(index)
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <span
        className={`relative min-w-0 break-words whitespace-pre-wrap text-foreground ${TEXT_SIZE[size]}`}
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

  const className = `option-tile overflow-hidden ${TILE_SIZE[size]}`;

  if (onPress) {
    return (
      <button
        type="button"
        role={role}
        aria-checked={role ? state === "selected" : undefined}
        onClick={onPress}
        disabled={disabled}
        data-state={state}
        data-locked={locked || undefined}
        className={`${className} w-full disabled:cursor-default`}
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
