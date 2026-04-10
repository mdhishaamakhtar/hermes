import type { ReactNode } from "react";

export function CardBadge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "success" | "warning" | "accent" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/30 text-success"
      : tone === "warning"
        ? "border-warning/30 text-warning"
        : tone === "accent"
          ? "border-primary/30 text-accent"
          : tone === "danger"
            ? "border-danger/30 text-danger"
            : "border-border text-muted";

  return (
    <span
      className={`inline-flex items-center border px-2 py-1 text-[11px] tracking-[0.18em] uppercase ${toneClass}`}
    >
      {children}
    </span>
  );
}
