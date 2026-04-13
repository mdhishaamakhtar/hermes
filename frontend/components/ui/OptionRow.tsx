"use client";

import type { ReactNode } from "react";

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

interface OptionRowProps {
  marker?: ReactNode;
  content: ReactNode;
  aside?: ReactNode;
  className?: string;
  markerClassName?: string;
  contentClassName?: string;
  asideClassName?: string;
}

export default function OptionRow({
  marker,
  content,
  aside,
  className,
  markerClassName,
  contentClassName,
  asideClassName,
}: OptionRowProps) {
  const gridColumns = marker
    ? aside
      ? "grid-cols-[1.5rem_minmax(0,1fr)_auto]"
      : "grid-cols-[1.5rem_minmax(0,1fr)]"
    : aside
      ? "grid-cols-[minmax(0,1fr)_auto]"
      : "grid-cols-1";

  return (
    <div
      className={joinClasses(
        "grid items-start gap-x-3 gap-y-2",
        gridColumns,
        className,
      )}
    >
      {marker ? (
        <div className={joinClasses("mt-0.5", markerClassName)}>{marker}</div>
      ) : null}
      <div
        className={joinClasses(
          "min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-foreground",
          contentClassName,
        )}
      >
        {content}
      </div>
      {aside ? (
        <div
          className={joinClasses(
            "mt-0.5 flex shrink-0 flex-wrap items-start justify-end gap-2 text-xs tabular-nums",
            asideClassName,
          )}
        >
          {aside}
        </div>
      ) : null}
    </div>
  );
}
