"use client";

import { motion } from "framer-motion";
import { CardBadge } from "@/components/session/CardBadge";
import { LiveParticipantCount } from "@/components/session/LiveParticipantCount";
import Logo from "@/components/Logo";
import { formatParticipantCountPhrase } from "@/lib/session-utils";
import { enterAnimation } from "@/lib/design-tokens";
import { useHostSession } from "@/features/session/host/useHostSession";

interface Props {
  session: ReturnType<typeof useHostSession>;
}

export function HostLobbyView({ session }: Props) {
  const {
    joinCode,
    participantCount,
    copied,
    loadingAction,
    handleCopyCode,
    handleStartSession,
  } = session;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 sm:px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Logo size="sm" />
          <div className="flex min-w-0 items-center gap-3">
            <CardBadge tone="warning">Lobby</CardBadge>
            <LiveParticipantCount
              count={participantCount}
              caption={formatParticipantCountPhrase(participantCount)}
              size="sm"
              layout="inline"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl flex-col items-center justify-center px-4 sm:px-6 py-10">
        <motion.div
          {...enterAnimation}
          className="flex w-full flex-col items-center"
        >
          <p className="label mb-8">Share this code with participants</p>

          <div className="w-full max-w-lg bg-surface px-6 py-8 sm:px-10 sm:py-10">
            <div
              className="flex select-all items-center justify-center gap-[0.3em] font-black text-foreground"
              style={{ fontSize: "clamp(2.5rem, 8vw, 4.5rem)" }}
            >
              {(joinCode || "------").split("").map((char, i) => (
                <span key={i}>{char}</span>
              ))}
            </div>
          </div>

          <button
            onClick={handleCopyCode}
            disabled={!joinCode}
            className="mt-5 border border-border bg-background px-6 py-3 text-xs tracking-widest uppercase text-muted transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy code"}
          </button>

          <div className="mt-14 w-full max-w-xs border-t border-border pt-10">
            <LiveParticipantCount
              count={participantCount}
              caption="in lobby"
              size="lg"
              layout="stack"
              className="w-full"
            />
          </div>

          <button
            onClick={handleStartSession}
            disabled={loadingAction === "start-session"}
            className="btn-primary mt-12"
          >
            {loadingAction === "start-session"
              ? "Starting..."
              : "Start Session"}
          </button>
        </motion.div>
      </main>
    </div>
  );
}
