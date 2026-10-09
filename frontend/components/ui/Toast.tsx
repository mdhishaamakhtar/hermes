"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { duration, ease } from "@/lib/motion";

/*
 * Brief, non-blocking confirmations and background failures: "Code copied",
 * "Couldn't save display mode". Anything a person must act on to continue
 * belongs inline next to the control instead, where it cannot time out.
 */

type Tone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

const LIFETIME_MS: Record<Tone, number> = {
  success: 3200,
  info: 3200,
  error: 7000,
};

const ICONS: Record<Tone, { name: IconName; className: string }> = {
  success: { name: "check", className: "text-success" },
  error: { name: "alert", className: "text-danger" },
  info: { name: "info", className: "text-accent" },
};

const EMPTY: ToastItem[] = [];
let items: ToastItem[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(tone: Tone, message: string) {
  const id = nextId++;
  // Three at most: a burst of failures should not wallpaper the screen.
  items = [...items.slice(-2), { id, tone, message }];
  emit();
}

function subscribeVisibility(listener: () => void) {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

/**
 * Counts down a toast's life only while someone could be reading it: the
 * clock stops while the tab is hidden or the pointer rests on the stack,
 * and picks up where it left off.
 */
function useLifetime(item: ToastItem, paused: boolean) {
  const remaining = useRef(LIFETIME_MS[item.tone]);
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [item.id, paused]);
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    () => false,
  );
  const [hovered, setHovered] = useState(false);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top,0px))] z-[var(--z-toast)] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence initial={false}>
        {list.map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            paused={hidden || hovered}
            onHover={setHovered}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({
  item,
  paused,
  onHover,
}: {
  item: ToastItem;
  paused: boolean;
  onHover: (hovered: boolean) => void;
}) {
  useLifetime(item, paused);
  // A card evicted from under the pointer never sees pointerleave; without
  // this the stack would stay paused for good.
  useEffect(() => () => onHover(false), [onHover]);
  const icon = ICONS[item.tone];

  // Leaves the way it arrived: up, toward the edge it dropped from.
  return (
    <motion.div
      layout
      role={item.tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: duration.base } }}
      transition={{ duration: duration.enter, ease: ease.out }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onHover(true);
      }}
      onPointerLeave={() => onHover(false)}
      className="pointer-events-auto flex w-full max-w-md items-start gap-3 border border-border-strong bg-raised py-3 pr-2 pl-4 text-sm text-foreground shadow-float"
    >
      <Icon
        name={icon.name}
        size={16}
        className={`mt-0.5 shrink-0 ${icon.className}`}
      />
      <p className="min-w-0 flex-1 py-px">{item.message}</p>
      <button
        type="button"
        onClick={() => {
          onHover(false);
          dismiss(item.id);
        }}
        aria-label="Dismiss"
        className="-my-1 flex size-7 shrink-0 items-center justify-center text-subtle transition-colors hover:text-foreground"
      >
        <Icon name="close" size={14} />
      </button>
    </motion.div>
  );
}
