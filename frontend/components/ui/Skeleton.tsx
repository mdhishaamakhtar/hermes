import type { ReactNode } from "react";

/** One shimmering placeholder block; size it with the real element's classes. */
export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/**
 * The region a skeleton stands in for. Announces "Loading …" once, instead of
 * leaving a screen reader to wander through empty placeholder blocks.
 */
export function LoadingRegion({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
