"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { duration, ease } from "@/lib/motion";

/*
 * Shared by the row and its skeleton, so a padding change moves both and the
 * list does not jump when data lands.
 */
const SHELL =
  "relative flex min-h-[4.5rem] items-center gap-4 border border-border bg-surface px-5 py-3.5";

/**
 * One navigable item in an organiser list: the whole row opens it, and a
 * delete button sits above the link layer. On pointer devices the delete
 * control waits for hover or focus, so a list reads as content first.
 */
export function ResourceRow({
  href,
  title,
  subtitle,
  leading,
  deleteLabel,
  onDelete,
}: {
  href: string;
  title: string;
  subtitle?: ReactNode;
  leading?: ReactNode;
  /** Accessible name for the delete button, e.g. "Delete event: Trivia". */
  deleteLabel: string;
  onDelete: () => void;
}) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: duration.base } }}
      transition={{ duration: duration.enter, ease: ease.out }}
      className={`group ${SHELL} transition-colors hover:border-border-strong hover:bg-raised has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent`}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          className="block truncate text-base font-semibold text-foreground after:absolute after:inset-0 focus-visible:outline-none"
        >
          {title}
        </Link>
        {subtitle && (
          <p className="mt-0.5 truncate text-sm text-subtle">{subtitle}</p>
        )}
      </div>
      <div className="relative z-[var(--z-raised)] flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          aria-label={deleteLabel}
          title="Delete"
          onClick={onDelete}
          className="hover:text-danger [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
        />
        <Icon
          name="arrow-right"
          size={16}
          className="text-subtle transition-[translate,color] duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
        />
      </div>
    </motion.li>
  );
}

/** Loading twin of {@link ResourceRow}. */
export function ResourceRowSkeleton({
  subtitle = true,
  leading = false,
}: {
  subtitle?: boolean;
  leading?: boolean;
}) {
  return (
    <li className={SHELL}>
      {leading && <Skeleton className="h-5 w-6 bg-border" />}
      <div className="min-w-0 flex-1">
        <Skeleton className="h-6 w-48 max-w-full bg-border" />
        {subtitle && <Skeleton className="mt-1 h-5 w-32 bg-border/60" />}
      </div>
    </li>
  );
}
