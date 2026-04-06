"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { motion, type HTMLMotionProps } from "framer-motion";

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
      className="group relative flex items-center justify-between px-6 py-4 bg-surface border border-border hover:border-primary/40 hover:bg-surface/80 transition-all"
    >
      <Link
        href={href}
        prefetch
        aria-label={ariaLabel}
        className="absolute inset-0"
      />
      <div className="relative z-10 pointer-events-none">{children}</div>
      <div className="relative z-10 flex items-center gap-4 pointer-events-none">
        <button
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          aria-label={deleteAriaLabel}
          className="pointer-events-auto label text-muted/40 hover:text-danger transition-colors focus-visible:outline-none focus-visible:opacity-100 focus-visible:text-danger focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
