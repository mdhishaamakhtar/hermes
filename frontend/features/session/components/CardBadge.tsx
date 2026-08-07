import type { ReactNode } from "react";

export function CardBadge({
  children,
  tone = "muted",
  className = "",
}: {
  children: ReactNode;
  tone?: "muted" | "success" | "warning" | "accent" | "danger";
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-success/30 bg-success/8 text-success"
      : tone === "warning"
        ? "border-warning/30 bg-warning/8 text-warning"
        : tone === "accent"
          ? "border-primary/30 bg-primary/8 text-accent"
          : tone === "danger"
            ? "border-danger/30 bg-danger/8 text-danger"
            : "border-border bg-border/30 text-muted";

  return (
    <span
      className={`inline-flex items-center border px-2 py-1 text-[11px] tracking-[0.18em] uppercase ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}
