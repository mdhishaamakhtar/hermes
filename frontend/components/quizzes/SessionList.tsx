"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { SessionItem } from "@/lib/types";

interface Props {
  sessions: SessionItem[];
  abandoning: boolean;
  onAbandon: (id: number) => void;
  onAbandonAll: () => void;
}

export default function SessionList({
  sessions,
  abandoning,
  onAbandon,
  onAbandonAll,
}: Props) {
  if (sessions.length === 0) return null;

  const hasNonEnded = sessions.some((s) => s.status !== "ENDED");

  return (
    <>
      <div className="h-px bg-border mb-6" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="label">Past Sessions</h2>
        {hasNonEnded && (
          <button
            onClick={onAbandonAll}
            disabled={abandoning}
            className="text-sm tracking-widest uppercase text-warning hover:text-warning/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
          >
            {abandoning ? "Abandoning..." : "Abandon All →"}
          </button>
        )}
      </div>
      <div className="list-stack">
        {sessions.map((session, index) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: index * 0.04 }}
            className="flex items-center justify-between px-6 py-4 bg-surface border border-border"
          >
            <div className="flex items-center gap-4">
              <span
                className={`text-xs tracking-widest uppercase px-2 py-0.5 ${
                  session.status === "ENDED"
                    ? "text-muted bg-border"
                    : session.status === "LOBBY"
                      ? "text-warning bg-warning/10"
                      : "text-success bg-success/10"
                }`}
              >
                {session.status}
              </span>
              <span className="text-xs text-muted tabular-nums">
                {session.participantCount} participants
              </span>
              {session.startedAt && (
                <span className="text-xs text-muted/50">
                  {new Date(session.startedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {session.status === "ENDED" && (
              <Link
                href={`/session/${session.id}/review`}
                prefetch
                className="label text-accent hover:text-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Review →
              </Link>
            )}

            {session.status !== "ENDED" && (
              <button
                onClick={() => onAbandon(session.id)}
                disabled={abandoning}
                className="label text-warning hover:text-warning/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
              >
                {abandoning ? "Abandoning..." : "Abandon →"}
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </>
  );
}
