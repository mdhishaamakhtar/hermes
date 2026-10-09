"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TopBar } from "@/components/TopBar";
import { RollingNumber } from "@/components/ui/AnimatedNumber";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { countNoun } from "@/lib/format";
import { fade } from "@/lib/motion";
import { StationClock, Tally, type TallyState } from "./OnAir";

/**
 * The header every live screen shares: the tally says where the session
 * is, the station clock runs on the host's screen. The mark does not link
 * home: one stray tap must not pull a host or a player out of a running
 * session.
 */
export function SessionTopBar({
  connected,
  participantCount,
  tally,
  clock = false,
  children,
}: {
  connected: boolean;
  participantCount: number;
  tally: TallyState;
  /** The station clock, for the screen the room watches. */
  clock?: boolean;
  children?: ReactNode;
}) {
  return (
    <TopBar home={null} width="stage">
      <ConnectionStatus connected={connected} />
      {children}
      {clock && <StationClock className="hidden md:inline" />}
      <PlayerCount count={participantCount} />
      <Tally state={tally} />
    </TopBar>
  );
}

/** A drop shorter than this is a routine reconnect, not news. */
const OFFLINE_GRACE_MS = 1500;

/**
 * Silent while the socket is up. When it drops (usually a phone that slept
 * or switched networks) it says so, so nobody mistakes a stale screen for a
 * frozen quiz. The quick reconnect a tab makes when it comes back to the
 * front passes without a flicker.
 */
function ConnectionStatus({ connected }: { connected: boolean }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (connected) return;
    const timer = window.setTimeout(() => setOffline(true), OFFLINE_GRACE_MS);
    return () => {
      window.clearTimeout(timer);
      setOffline(false);
    };
  }, [connected]);

  return (
    <span role="status" aria-live="polite" className="contents">
      <AnimatePresence initial={false}>
        {offline && (
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
