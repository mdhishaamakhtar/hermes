import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "live" | "success" | "warning" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-border-strong text-muted",
  live: "border-tally/50 bg-tally/10 text-tally",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
};

/**
 * A compact status chip. `dot` adds a square status light, steady like the
 * tally: a state is shown, not flashed. Waiting signals pulse with
 * `.live-dot` instead, where they appear.
 */
export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className = "",
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 border px-2 py-1 text-[0.6875rem] leading-none font-semibold tracking-[0.12em] uppercase ${TONES[tone]} ${className}`}
    >
      {dot && <span aria-hidden className="size-1.5 bg-current" />}
      {children}
    </span>
  );
}
