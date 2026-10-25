"use client";

import { AnimatePresence, motion } from "motion/react";
import { duration, ease } from "@/lib/motion";
import type { PlayerInfo } from "../session-types";

const SIZE = {
  /** The big screen's lobby. */
  screen: {
    list: "gap-[1vh]",
    chip: "px-[1vw] py-[0.9vh] text-[clamp(1rem,2.6vh,1.875rem)]",
  },
  page: { list: "gap-1.5", chip: "px-2.5 py-1.5 text-sm" },
} as const;

/**
 * Names as they arrive, newest first, each landing with a short rise so a
 * room can watch itself fill up. Every chip is the same size; a name too
 * long for the frame is cut, not shrunk. Past `limit`, the rest are counted.
 */
export function PlayerRoll({
  players,
  limit,
  size = "page",
  className = "",
}: {
  players: PlayerInfo[];
  limit?: number;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const newestFirst = players.toReversed();
  const shown = limit ? newestFirst.slice(0, limit) : newestFirst;
  const more = newestFirst.length - shown.length;
  const look = SIZE[size];

  return (
    <ul
      aria-label="Players"
      className={`flex flex-wrap ${look.list} ${className}`}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((player) => (
          <motion.li
            key={player.participantId}
            layout="position"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: duration.base } }}
            transition={{ duration: duration.enter, ease: ease.out }}
            className={`max-w-[18ch] truncate border border-border-strong bg-surface leading-none text-foreground ${look.chip}`}
          >
            {player.displayName}
          </motion.li>
        ))}
        {more > 0 && (
          <motion.li
            key="more"
            layout="position"
            className={`border border-border leading-none text-muted ${look.chip}`}
          >
            +{more} more
          </motion.li>
        )}
      </AnimatePresence>
    </ul>
  );
}
