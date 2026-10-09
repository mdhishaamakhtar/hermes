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
const REORDER_DELAY = 0.22;
const CLIMB_DELAY = 0.5;

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
  emptyText = "Standings appear after the first question is graded.",
}: {
  entries: LeaderboardEntry[];
  /** The viewing player, highlighted wherever they sit. */
  meId?: number | null;
  limit?: number;
  emptyText?: string;
}) {
  const climbs = useClimbs(entries);
  const sorted = entries.toSorted((a, b) => a.rank - b.rank);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const me =
    meId != null ? sorted.find((e) => e.participantId === meId) : undefined;
  const meHidden = me && !shown.includes(me);

  if (sorted.length === 0) {
    return <p className="py-2 text-sm text-subtle">{emptyText}</p>;
  }

  return (
    // popLayout lifts a leaving row out of the flow at once, so the rows
    // that stay travel straight to their final slot in a single move instead
    // of being shoved past it and snapping back.
    <ol className="relative flex flex-col gap-1.5">
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
              live
            />
          </motion.li>
        ))}
      </AnimatePresence>
      {meHidden && (
        <li className="mt-2 border-t border-dashed border-border-strong pt-3">
          <Row entry={me} me climb={climbs[me.participantId]} live />
        </li>
      )}
    </ol>
  );
}

function Row({
  entry,
  me,
  climb,
  live = false,
}: {
  entry: LeaderboardEntry;
  me: boolean;
  /** Places gained in the latest reshuffle. */
  climb?: number;
  /** Scores roll to new totals; final standings just state them. */
  live?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 border px-3.5 py-2.5 ${
        me ? "border-primary bg-primary/10" : "border-border bg-background"
      }`}
    >
      <span
        className={`w-7 shrink-0 font-mono text-sm font-semibold tabular-nums ${
          entry.rank === 1 ? "text-accent" : "text-subtle"
        }`}
      >
        {entry.rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {entry.displayName}
        {me && (
          <span className="ml-2 text-xs font-semibold text-accent">You</span>
        )}
      </span>
      {/* Lands once the row has arrived, rising the way the row moved. */}
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
            className="flex shrink-0 items-center gap-0.5 font-mono text-xs font-semibold text-success tabular-nums"
          >
            <Icon name="arrow-up" size={12} />
            <span className="sr-only">Up </span>
            {climb}
          </motion.span>
        )}
      </AnimatePresence>
      {live ? (
        <RollingNumber
          value={entry.score}
          className="font-mono text-sm font-semibold text-foreground"
        />
      ) : (
        <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
          {formatNumber(entry.score)}
        </span>
      )}
    </div>
  );
}

/** Reveal order for the podium: third, then second, then the winner. */
const PODIUM_DELAY = [0.9, 0.5, 0.15];

/**
 * The final standings, told as a reveal: third place lands, then second,
 * then the winner, bigger and lit. Everyone else follows as a list.
 */
export function FinalStandings({
  entries,
  meId,
}: {
  entries: LeaderboardEntry[];
  meId?: number | null;
}) {
  const sorted = entries.toSorted((a, b) => a.rank - b.rank);
  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  if (sorted.length === 0) {
    return <p className="text-sm text-subtle">Nobody answered this time.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {podium.map((entry, index) => {
        const winner = index === 0;
        const me = entry.participantId === meId;
        return (
          <motion.div
            key={entry.participantId}
            initial={{ opacity: 0, y: 12, scale: winner ? 0.97 : 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: duration.stage,
              ease: ease.out,
              delay: PODIUM_DELAY[index],
            }}
            className={`flex items-center gap-4 border px-4 ${
              winner
                ? "border-accent/60 bg-accent/10 py-5 sm:px-6"
                : me
                  ? "border-primary bg-primary/10 py-3.5"
                  : "border-border-strong bg-surface py-3.5"
            }`}
          >
            <span
              className={`w-9 shrink-0 font-mono font-semibold tabular-nums ${
                winner ? "text-3xl text-accent" : "text-xl text-muted"
              }`}
            >
              {entry.rank}
            </span>
            <span
              className={`min-w-0 flex-1 truncate font-semibold text-foreground ${
                winner ? "text-2xl" : "text-lg"
              }`}
            >
              {entry.displayName}
              {me && <span className="ml-2 text-sm text-accent">You</span>}
            </span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                winner ? "text-2xl text-foreground" : "text-lg text-foreground"
              }`}
            >
              {formatNumber(entry.score)}
            </span>
          </motion.div>
        );
      })}
      {rest.length > 0 && (
        <ol className="mt-2 flex flex-col gap-1.5">
          {rest.map((entry, index) => (
            <motion.li
              key={entry.participantId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: duration.enter,
                delay: 1.2 + stagger(index),
              }}
            >
              <Row entry={entry} me={entry.participantId === meId} />
            </motion.li>
          ))}
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
