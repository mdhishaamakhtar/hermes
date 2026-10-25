"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RollingNumber } from "@/components/ui/AnimatedNumber";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatNumber } from "@/lib/format";
import { duration, ease, spring, stagger } from "@/lib/motion";
import type { LeaderboardEntry } from "../session-types";

type Climbs = Record<number, number>;

/*
 * A reshuffle is told in order, cause then effect, the way a broadcast
 * scoreboard does it: the points land first (scores roll in place), then
 * the order follows (rows travel to their new slots), then the climb marks
 * say who moved. Each beat starts as the last one is mostly done, so the
 * whole thing reads as one move, not three things at once.
 */
const REORDER_DELAY = 0.35;
const CLIMB_DELAY = 0.85;

/** A row that climbed into view rises from below; one that fell out sinks. */
const ROW_TRAVEL = 14;

/**
 * Places each player gained in the latest reshuffle. Held until the order
 * next changes, so a repeated update with the same ranks keeps the marks.
 */
function useClimbs(entries: LeaderboardEntry[]): Climbs {
  const [seen, setSeen] = useState({ entries, climbs: {} as Climbs });
  if (seen.entries !== entries) {
    const before = new Map(
      seen.entries.map((entry) => [entry.participantId, entry.rank]),
    );
    const climbs: Climbs = {};
    let reshuffled = false;
    for (const entry of entries) {
      const was = before.get(entry.participantId);
      if (was === undefined || was === entry.rank) continue;
      reshuffled = true;
      if (was > entry.rank) climbs[entry.participantId] = was - entry.rank;
    }
    setSeen({ entries, climbs: reshuffled ? climbs : seen.climbs });
  }
  return seen.climbs;
}

/**
 * Standings as they move. Rows are keyed by player, so when a question is
 * graded and the order changes, each player slides to their new rank
 * instead of the list redrawing in place, scores roll to their new totals,
 * and anyone who climbed carries a mark saying how far.
 */
export function Leaderboard({
  entries,
  meId,
  limit,
  emptyText = "Standings appear once someone scores.",
  size = "page",
}: {
  entries: LeaderboardEntry[];
  /** The viewing player, highlighted wherever they sit. */
  meId?: number | null;
  limit?: number;
  emptyText?: string;
  /**
   * `screen` and `screen-lg` for the big screen's standings scene: the
   * larger matches the finale's podium, for a board of five rows or fewer.
   */
  size?: RowSize;
}) {
  const climbs = useClimbs(entries);
  const sorted = entries.toSorted((a, b) => a.rank - b.rank);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const me =
    meId != null ? sorted.find((e) => e.participantId === meId) : undefined;
  const meHidden = me && !shown.includes(me);

  // A board of zeros ranks nobody: everyone on it is level.
  if (sorted.every((entry) => entry.score === 0)) {
    return <p className={`text-subtle ${ROW_SIZE[size].empty}`}>{emptyText}</p>;
  }

  return (
    // popLayout lifts a leaving row out of the flow at once, so the rows
    // that stay travel straight to their final slot in a single move instead
    // of being shoved past it and snapping back.
    <ol className={`relative flex flex-col ${ROW_SIZE[size].list}`}>
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((entry) => (
          <motion.li
            key={entry.participantId}
            layout="position"
            initial={{ opacity: 0, y: ROW_TRAVEL }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: ROW_TRAVEL,
              transition: {
                duration: duration.base,
                ease: ease.out,
                delay: REORDER_DELAY,
              },
            }}
            transition={{
              layout: { ...spring.slot, delay: REORDER_DELAY },
              default: {
                duration: duration.enter,
                ease: ease.out,
                delay: REORDER_DELAY,
              },
            }}
          >
            <Row
              entry={entry}
              me={entry.participantId === meId}
              climb={climbs[entry.participantId]}
              size={size}
            />
          </motion.li>
        ))}
      </AnimatePresence>
      {meHidden && (
        <li className="mt-2 border-t border-dashed border-border-strong pt-3">
          <Row entry={me} me climb={climbs[me.participantId]} size={size} />
        </li>
      )}
    </ol>
  );
}

type RowSize = "page" | "screen" | "screen-lg";

/*
 * One grid for every row (rank, name, climb, score) with a fixed rank
 * column, so names and scores stay straight columns while rows travel.
 */
const ROW_SIZE = {
  page: {
    list: "gap-1.5 [--rank:1.75rem]",
    row: "gap-x-3 px-3.5 py-2.5 text-sm",
    empty: "py-2 text-sm",
    name: "text-base",
    climb: "text-xs",
    icon: 12,
  },
  screen: {
    list: "gap-[1.1vh] [--rank:clamp(3.5rem,8vh,6rem)]",
    row: "gap-x-[1.5vw] px-[2vw] py-[1.4vh] text-[clamp(1.375rem,3.8vh,2.75rem)]",
    empty: "text-[clamp(1.25rem,3vh,2rem)]",
    name: "",
    climb: "text-[0.6em]",
    icon: 24,
  },
  // The finale's podium row (PODIUM_SIZE.screen), so the standings between
  // questions and the final standings read as one scoreboard.
  "screen-lg": {
    list: "gap-[1.5vh] [--rank:clamp(4rem,9vh,6.5rem)]",
    row: "gap-x-[1.5vw] px-[2vw] py-[2.4vh] text-[clamp(1.75rem,5vh,3.75rem)]",
    empty: "text-[clamp(1.25rem,3vh,2rem)]",
    name: "",
    climb: "text-[0.55em]",
    icon: 28,
  },
} as const;

function Row({
  entry,
  me,
  climb,
  size = "page",
}: {
  entry: LeaderboardEntry;
  me: boolean;
  /** Places gained in the latest reshuffle. */
  climb?: number;
  size?: RowSize;
}) {
  const look = ROW_SIZE[size];
  return (
    <div
      className={`grid grid-cols-[var(--rank)_minmax(0,1fr)_auto_auto] items-baseline border ${look.row} ${
        me ? "border-primary bg-primary/10" : "border-border bg-background"
      }`}
    >
      <span
        className={`font-mono leading-none font-semibold tabular-nums ${
          entry.rank === 1 ? "text-accent" : "text-subtle"
        }`}
      >
        {entry.rank}
      </span>
      <span
        className={`min-w-0 truncate leading-tight text-foreground ${look.name}`}
      >
        {entry.displayName}
        {me && (
          <span className="ml-[0.6em] text-[0.75em] font-semibold text-accent">
            You
          </span>
        )}
      </span>
      {/* Lands once the row has arrived, rising the way the row moved. */}
      <span
        className={`font-mono font-semibold text-success tabular-nums ${look.climb}`}
      >
        <AnimatePresence>
          {climb && (
            <motion.span
              key={`${entry.rank}-${climb}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: duration.base } }}
              transition={{
                duration: duration.enter,
                ease: ease.out,
                delay: CLIMB_DELAY,
              }}
              className="inline-flex items-center gap-0.5"
            >
              <Icon name="arrow-up" size={look.icon} className="self-center" />
              <span className="sr-only">Up </span>
              {climb}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <RollingNumber
        value={entry.score}
        className="font-mono leading-none font-semibold text-foreground"
      />
    </div>
  );
}

/**
 * When each podium place lands, winner first in the array: third, then
 * second, then the winner. The big screen takes its time; a page does not.
 */
export const PODIUM_DELAY = {
  quick: [0.9, 0.5, 0.15],
  show: [4.2, 2.6, 1.0],
} as const;

/*
 * Every podium row is the same row: one grid (a fixed rank column, the name,
 * the score), one type size, one padding. The winner is told by the lit
 * rank and the key-light tint, and by landing last, never by being bigger,
 * so the names read as one column and the scores as another.
 */
const PODIUM_SIZE = {
  page: {
    list: "gap-2 [--rank:3rem]",
    row: "px-4 py-3.5 sm:px-5",
    type: "text-lg",
  },
  screen: {
    list: "gap-[1.5vh] [--rank:clamp(4rem,9vh,6.5rem)]",
    row: "gap-x-[1.5vw] px-[2vw] py-[2.4vh]",
    type: "text-[clamp(1.75rem,5vh,3.75rem)]",
  },
} as const;

/**
 * The final standings, told as a reveal: third place lands, then second,
 * then the winner, lit. Everyone else follows in the same columns; on the
 * big screen only the podium shows.
 */
export function FinalStandings({
  entries,
  meId,
  size = "page",
  pace = "quick",
}: {
  entries: LeaderboardEntry[];
  meId?: number | null;
  size?: keyof typeof PODIUM_SIZE;
  /** `show` for the big screen's finale, one place at a time. */
  pace?: keyof typeof PODIUM_DELAY;
}) {
  const sorted = entries.toSorted((a, b) => a.rank - b.rank);
  const podium = sorted.filter((entry) => entry.score > 0).slice(0, 3);
  const rest = sorted.filter((entry) => !podium.includes(entry));
  const look = PODIUM_SIZE[size];

  if (podium.length === 0) {
    return <p className="text-sm text-subtle">Nobody scored this time.</p>;
  }

  return (
    <div className={`flex flex-col ${look.list}`}>
      {podium.map((entry, index) => {
        const winner = index === 0;
        const me = entry.participantId === meId;
        return (
          <motion.div
            key={entry.participantId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: duration.stage,
              ease: ease.out,
              delay: PODIUM_DELAY[pace][index],
            }}
            className={`grid grid-cols-[var(--rank)_minmax(0,1fr)_auto] items-baseline border ${look.row} ${look.type} ${
              winner
                ? "border-accent/60 bg-accent/10"
                : me
                  ? "border-primary bg-primary/10"
                  : "border-border-strong bg-surface"
            }`}
          >
            <span
              className={`font-mono leading-none font-semibold tabular-nums ${
                winner ? "text-accent" : "text-muted"
              }`}
            >
              {entry.rank}
            </span>
            <span className="min-w-0 truncate leading-tight font-semibold text-foreground">
              {entry.displayName}
              {me && (
                <span className="ml-[0.6em] text-[0.55em] text-accent">
                  You
                </span>
              )}
            </span>
            <span className="pl-4 font-mono leading-none font-semibold text-foreground tabular-nums">
              {formatNumber(entry.score)}
            </span>
          </motion.div>
        );
      })}
      {size === "page" && rest.length > 0 && (
        // The rest keep the podium's columns, so every name in the
        // standings starts on one edge.
        <ol className="mt-2 flex flex-col gap-1.5">
          {rest.map((entry, index) => {
            const me = entry.participantId === meId;
            return (
              <motion.li
                key={entry.participantId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: duration.enter,
                  delay: 1.2 + stagger(index),
                }}
                className={`grid grid-cols-[var(--rank)_minmax(0,1fr)_auto] items-baseline border px-4 py-2.5 text-lg sm:px-5 ${
                  me
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background"
                }`}
              >
                <span className="font-mono leading-none font-semibold text-subtle tabular-nums">
                  {entry.rank}
                </span>
                <span className="min-w-0 truncate leading-tight text-foreground">
                  {entry.displayName}
                  {me && (
                    <span className="ml-[0.6em] text-[0.55em] font-semibold text-accent">
                      You
                    </span>
                  )}
                </span>
                <span className="pl-4 font-mono leading-none font-semibold text-foreground tabular-nums">
                  {formatNumber(entry.score)}
                </span>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: rows }, (_, row) => (
        <Skeleton key={row} className="h-11 bg-background" />
      ))}
    </div>
  );
}
