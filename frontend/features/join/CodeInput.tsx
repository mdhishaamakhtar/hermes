"use client";

import { useRef, useState, type ComponentProps } from "react";
import { motion } from "motion/react";

export const CODE_LENGTH = 6;

/** Join codes are six characters of A–Z and 0–9; anything else is dropped. */
export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

const SIZES = {
  md: "h-14 text-2xl",
  lg: "h-16 text-3xl sm:h-20 sm:text-4xl",
} as const;

/**
 * Six cells, one real input. The input is invisible and stretched across
 * the cells, so typing, pasting, autofill, and the mobile keyboard all work
 * natively; the cells only draw what it holds. Each character settles into
 * its cell as it lands.
 */
export function CodeInput({
  value,
  onChange,
  size = "lg",
  invalid = false,
  className = "",
  ...inputProps
}: {
  value: string;
  onChange: (code: string) => void;
  size?: keyof typeof SIZES;
  invalid?: boolean;
  className?: string;
} & Omit<ComponentProps<"input">, "value" | "onChange" | "size">) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(normalizeCode(event.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={CODE_LENGTH}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        className="absolute inset-0 z-[var(--z-raised)] h-full w-full cursor-text opacity-0"
        {...inputProps}
      />
      <div aria-hidden className="grid grid-cols-6 gap-1.5 sm:gap-2">
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const char = value[index] ?? "";
          const active = focused && index === activeIndex;
          const border = invalid
            ? "border-danger"
            : active
              ? "border-primary shadow-[inset_0_0_0_1px_var(--color-primary)]"
              : char
                ? "border-border-strong"
                : "border-border";
          return (
            <div
              key={index}
              className={`relative flex items-center justify-center border bg-background font-mono font-semibold text-foreground transition-[border-color,box-shadow] duration-150 ${SIZES[size]} ${border}`}
            >
              {char ? (
                <motion.span
                  key={char}
                  initial={{ opacity: 0, y: "35%" }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 30 }}
                >
                  {char}
                </motion.span>
              ) : (
                active && <span className="caret" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
