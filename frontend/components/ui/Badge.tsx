import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "live" | "success" | "warning" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-border-strong text-muted",
  live: "border-accent/40 bg-accent/10 text-accent",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
};

/**
 * A compact status chip. `dot` adds a status light; it pulses only for
 * "live", the one tone that means something is happening right now.
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
      {dot &&
        (tone === "live" ? (
          <span aria-hidden className="live-dot size-1.5" />
        ) : (
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
        ))}
      {children}
    </span>
  );
}
