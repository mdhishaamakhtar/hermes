import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

const TONES = {
  danger: { box: "border-danger/40 bg-danger/10", icon: "text-danger" },
  warning: { box: "border-warning/40 bg-warning/10", icon: "text-warning" },
  info: { box: "border-accent/30 bg-accent/5", icon: "text-accent" },
} as const;

/**
 * An inline message about the surrounding task. A danger alert is announced
 * the moment it appears; the others wait their turn.
 */
export function Alert({
  tone = "danger",
  children,
  action,
  className = "",
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const style = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 border px-4 py-3 text-sm text-foreground ${style.box} ${className}`}
    >
      <Icon
        name={tone === "info" ? "info" : "alert"}
        size={16}
        className={`mt-0.5 shrink-0 ${style.icon}`}
      />
      {/* Where the message and its action don't both fit, the action drops
          below the message, lined up with it, rather than squeezing it into
          a column a word wide. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-56">{children}</div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
