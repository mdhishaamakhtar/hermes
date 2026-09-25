import type { ReactNode } from "react";

/**
 * An empty list teaches the next step: what belongs here, and the one action
 * that puts it there. The dashed frame reads as a slot waiting to be filled.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center border border-dashed border-border-strong px-6 py-14 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
