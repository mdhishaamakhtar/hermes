"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { Shimmer } from "@/components/ui/Shimmer";

type Variant = "compact" | "default" | "review";

/*
 * Per-variant geometry, shared with LeaderboardRowSkeleton below so the
 * placeholder cannot drift from the row it stands in for.
 */
const PADDING: Record<Variant, string> = {
  compact: "px-3 py-2.5",
  default: "px-4 py-3",
  review: "px-6 py-4",
};
const GAP: Record<Variant, string> = {
  compact: "gap-3",
  default: "gap-4",
  review: "gap-5",
};
const RANK_WIDTH: Record<Variant, string> = {
  compact: "w-5",
  default: "w-6",
  review: "w-8",
};
const RANK_TEXT: Record<Variant, string> = {
  compact: "text-xs shrink-0",
  default: "text-sm",
  review: "text-lg",
};

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

  const padding = PADDING[variant];
  const gap = GAP[variant];
  const rankSize = `${RANK_TEXT[variant]} ${RANK_WIDTH[variant]}`;
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

/** Loading twin of {@link LeaderboardRow}, sharing its per-variant geometry. */
export function LeaderboardRowSkeleton({
  variant = "review",
}: {
  variant?: Variant;
}) {
  return (
    <div
      className={`flex items-center justify-between ${PADDING[variant]} border border-border bg-surface`}
    >
      <div className={`flex items-center ${GAP[variant]} min-w-0`}>
        <Shimmer h="h-5" w={RANK_WIDTH[variant]} on="border" />
        <Shimmer h="h-4" w="w-28" tone="soft" on="border" />
      </div>
      <Shimmer h="h-4" w="w-12" on="border" />
    </div>
  );
}
