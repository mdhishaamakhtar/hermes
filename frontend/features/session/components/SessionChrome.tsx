"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TopBar } from "@/components/TopBar";
import { RollingNumber } from "@/components/ui/AnimatedNumber";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { countNoun } from "@/lib/format";
import { fade } from "@/lib/motion";

/**
 * The header every live screen shares. The mark does not link home: one
 * stray tap must not pull a host or a player out of a running session.
 */
export function SessionTopBar({
  connected,
  participantCount,
  children,
}: {
  connected: boolean;
  participantCount: number;
  children?: ReactNode;
}) {
  return (
    <TopBar home={null} width="stage">
      <ConnectionStatus connected={connected} />
      {children}
      <PlayerCount count={participantCount} />
    </TopBar>
  );
}

/**
 * Silent while the socket is up. When it drops (usually a phone that slept
 * or switched networks) it says so, so nobody mistakes a stale screen for a
 * frozen quiz.
 */
function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <span role="status" aria-live="polite" className="contents">
      <AnimatePresence initial={false}>
        {!connected && (
          <motion.span key="offline" {...fade}>
            <Badge tone="warning" dot>
              Reconnecting
            </Badge>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function PlayerCount({ count }: { count: number }) {
  return (
    <span
      className="flex items-center gap-1.5 text-sm text-muted"
      aria-label={`${count} ${countNoun(count, "player", "players")}`}
    >
      <Icon name="user" size={15} className="text-subtle" />
      <RollingNumber value={count} className="font-mono text-foreground" />
      <span aria-hidden className="hidden sm:inline">
        {countNoun(count, "player", "players")}
      </span>
    </span>
  );
}

/**
 * Reading text that belongs to the questions on stage. Long passages fold
 * to a few lines on small screens so the question stays in reach.
 */
export function PassagePanel({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420;
  return (
    <section
      aria-label="Passage"
      className="border border-border bg-surface px-5 py-4 sm:px-6 sm:py-5"
    >
      <p className="label mb-2.5">Passage</p>
      <p
        className={`max-w-[72ch] text-base leading-7 whitespace-pre-wrap text-foreground/90 ${
          long && !open ? "line-clamp-5 sm:line-clamp-none" : ""
        } sm:max-h-[40vh] sm:overflow-y-auto`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="mt-2 text-sm font-medium text-accent sm:hidden"
        >
          {open ? "Show less" : "Read the whole passage"}
        </button>
      )}
    </section>
  );
}
