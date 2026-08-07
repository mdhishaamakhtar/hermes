"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { motion, type HTMLMotionProps } from "framer-motion";
import { LINE, Shimmer } from "@/components/ui/Shimmer";

/**
 * The box every resource row occupies. Shared with ResourceRowSkeleton below
 * so a padding change cannot move the real row without moving its
 * placeholder — the mismatch that produced the list jump fixed in 032341d.
 */
const ROW_SHELL =
  "flex items-center justify-between px-6 py-4 bg-surface border border-border";

interface ResourceRowProps extends HTMLMotionProps<"div"> {
  href: string;
  ariaLabel: string;
  onDelete: () => void;
  deleteAriaLabel: string;
  children: ReactNode;
}

export default function ResourceRow({
  href,
  ariaLabel,
  onDelete,
  deleteAriaLabel,
  children,
  ...motionProps
}: ResourceRowProps) {
  return (
    <motion.div
      {...motionProps}
      className={`group relative ${ROW_SHELL} hover:border-primary/40 hover:bg-surface/80 transition-all`}
    >
      <Link
        href={href}
        prefetch
        aria-label={ariaLabel}
        className="absolute inset-0"
      />
      <div className="relative z-[var(--z-raised)] pointer-events-none">
        {children}
      </div>
      <div className="relative z-[var(--z-raised)] flex items-center gap-4 pointer-events-none">
        <button
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          aria-label={deleteAriaLabel}
          // text-muted/75 is the lowest opacity that still clears 4.5:1 on
          // surface (4.60:1). It reads as quietly as the old /40 did against
          // the row title, but /40 measured 2.15:1 — illegible for the only
          // visible affordance of a destructive action. The -my-3 py-3 keeps
          // the tap target at 40px without changing the row's height.
          className="pointer-events-auto label -my-3 py-3 text-muted/75 hover:text-danger transition-colors focus-visible:outline-none focus-visible:opacity-100 focus-visible:text-danger focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Delete
        </button>
        <span
          aria-hidden
          className="text-muted/40 group-hover:text-accent transition-colors select-none"
        >
          →
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Loading twin of {@link ResourceRow}. Heights match the real row's line
 * boxes: `h-6` for the 16px title (leading included), `h-4` for the subtitle.
 */
export function ResourceRowSkeleton({
  subtitle = false,
  leading = false,
}: {
  subtitle?: boolean;
  /** Mirrors rows that open with an index number, e.g. the quiz list. */
  leading?: boolean;
}) {
  return (
    <div className={ROW_SHELL}>
      <div className={leading ? "flex items-center gap-4" : undefined}>
        {leading && <Shimmer h="h-4" w="w-5" tone="soft" on="border" />}
        <div>
          <Shimmer h={LINE} w={leading ? "w-32" : "w-36"} on="border" />
          {subtitle && (
            <Shimmer
              h="h-4"
              w="w-24"
              tone="soft"
              on="border"
              className="mt-1"
            />
          )}
        </div>
      </div>
      <Shimmer h={LINE} w="w-4" tone="soft" on="border" />
    </div>
  );
}
