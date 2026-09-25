"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { spring } from "@/lib/motion";

export interface Segment<T extends string> {
  value: T;
  label: string;
  /** Shown under the control while this segment is selected. */
  description?: string;
}

interface SegmentedControlProps<T extends string> {
  /** Pairs with a <Field id=…>, whose label names the group. */
  id: string;
  value: T;
  options: readonly Segment<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * A single choice among a few options, all visible at once. An ARIA radio
 * group: one tab stop, arrow keys move and select, the selection slides.
 */
export function SegmentedControl<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  const indicatorId = useId();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const description = options[selectedIndex]?.description;

  const select = (index: number) => {
    const next = options[(index + options.length) % options.length];
    onChange(next.value);
    buttonsRef.current[options.indexOf(next)]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: options.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    select(moves[event.key]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        id={id}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        aria-disabled={disabled || undefined}
        className="flex w-full border border-border-strong bg-background p-0.5 aria-disabled:opacity-50"
      >
        {options.map((option, index) => {
          const checked = index === selectedIndex;
          return (
            <button
              key={option.value}
              ref={(node) => {
                buttonsRef.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={
                checked || (selectedIndex === -1 && index === 0) ? 0 : -1
              }
              disabled={disabled}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`relative min-h-9 flex-1 px-3 text-sm font-medium transition-colors focus-visible:outline-offset-0 disabled:cursor-not-allowed ${
                checked ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {checked && (
                <motion.span
                  layoutId={indicatorId}
                  transition={spring.slot}
                  aria-hidden
                  className="absolute inset-0 border border-primary bg-primary/15"
                />
              )}
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>
      {description && (
        <p id={`${id}-description`} className="text-sm text-subtle">
          {description}
        </p>
      )}
    </div>
  );
}
