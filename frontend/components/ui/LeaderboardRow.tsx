"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type Variant = "compact" | "default" | "review";

interface LeaderboardRowProps extends HTMLMotionProps<"div"> {
  rank: number;
  displayName: string;
  score: number;
  variant?: Variant;
  isMe?: boolean;
}

function rankColor(rank: number, variant: Variant): string {
  if (variant === "review") {
    if (rank === 1) return "var(--color-accent)";
    if (rank <= 3) return "var(--color-muted)";
    return "var(--color-muted-dark)";
  }
  if (rank === 1) return "var(--color-warning)";
  if (rank <= 3) return "var(--color-muted)";
  return "var(--color-muted-dark)";
}

export default function LeaderboardRow({
  rank,
  displayName,
  score,
  variant = "default",
  isMe = false,
  ...motionProps
}: LeaderboardRowProps) {
  const isCompact = variant === "compact";
  const isReview = variant === "review";

  const padding = isCompact
    ? "px-3 py-2.5"
    : isReview
      ? "px-6 py-4"
      : "px-4 py-3";
  const gap = isCompact ? "gap-3" : isReview ? "gap-5" : "gap-4";
  const rankSize = isCompact
    ? "text-xs w-5 shrink-0"
    : isReview
      ? "text-lg w-8"
      : "text-sm w-6";
  const nameStyle = isCompact
    ? "text-sm text-foreground truncate"
    : isReview || isMe
      ? `text-sm font-medium ${rank === 1 || isMe ? "text-foreground" : "text-muted"}`
      : "text-foreground";
  const scoreStyle = isReview
    ? "font-bold tabular-nums text-foreground"
    : `${isCompact ? "text-sm shrink-0 ml-2" : ""} tabular-nums text-success font-bold`;
  const border = isMe
    ? "border-primary"
    : isReview && rank === 1
      ? "border-primary/40"
      : "border-border";

  return (
    <motion.div
      {...motionProps}
      className={`flex items-center justify-between ${padding} border ${border} ${isMe ? "bg-primary/5" : "bg-surface"}`}
    >
      <div className={`flex items-center ${gap} min-w-0`}>
        <span
          className={`tabular-nums font-bold ${rankSize}`}
          style={{ color: rankColor(rank, variant) }}
        >
          {rank}
        </span>
        <span className={nameStyle}>{displayName}</span>
      </div>
      <span className={scoreStyle}>
        {isReview ? score.toLocaleString() : score}
      </span>
    </motion.div>
  );
}
