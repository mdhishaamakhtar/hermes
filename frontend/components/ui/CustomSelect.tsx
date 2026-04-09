"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  title?: string;
  id?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  disabled = false,
  title,
  id,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const listboxId = `${selectId}-listbox`;
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropUp, setDropUp] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    requestAnimationFrame(() => {
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = Math.min(options.length * 44 + 8, 240);
      setDropUp(spaceBelow < dropdownHeight && rect.top > dropdownHeight);
    });
  }, [open, options.length]);

  const handleToggle = () => {
    if (disabled) return;
    if (open) {
      close();
    } else {
      setOpen(true);
      const idx = options.findIndex((opt) => opt.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    close();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        handleToggle();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          handleSelect(options[focusedIndex].value);
        }
        break;
    }
  };

  useEffect(() => {
    if (!open || focusedIndex < 0 || !listboxRef.current) return;
    const item = listboxRef.current.children[focusedIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex, open]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        id={selectId}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        title={title}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center justify-between gap-3 border border-border bg-surface px-4 py-3 text-left text-base text-foreground outline-none transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:shadow-[0_0_0_1px_var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 truncate">
          {selectedOption?.label ?? "Select…"}
        </span>
        <motion.svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="shrink-0 text-muted"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            ref={listboxRef}
            role="listbox"
            id={listboxId}
            aria-activedescendant={
              focusedIndex >= 0
                ? `${selectId}-option-${focusedIndex}`
                : undefined
            }
            initial={{ opacity: 0, y: dropUp ? 6 : -6, scaleY: 0.92 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: dropUp ? 6 : -6, scaleY: 0.92 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute left-0 right-0 z-[100] max-h-60 overflow-y-auto border border-border bg-surface py-1 shadow-[0_8px_24px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.3)] ${
              dropUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
            }`}
            style={{ transformOrigin: dropUp ? "bottom" : "top" }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isFocused = index === focusedIndex;

              return (
                <button
                  key={option.value}
                  type="button"
                  id={`${selectId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    isFocused
                      ? "bg-primary/12 text-foreground"
                      : isSelected
                        ? "text-accent"
                        : "text-muted"
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      className="shrink-0 text-accent"
                    >
                      <path
                        d="M3 7.5L5.5 10L11 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="square"
                      />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
