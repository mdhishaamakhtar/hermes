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

      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-7xl items-center justify-center px-4 sm:px-6 py-10">
        <motion.div
          {...enterAnimation}
          className="w-full max-w-2xl border border-border bg-surface p-8 text-center"
        >
          <p className="label mb-4">Share this code</p>
          <div
            className="select-all border border-primary/30 bg-background px-8 py-6 font-black tracking-[0.35em] text-foreground"
            style={{
              fontSize: "clamp(2rem, 7vw, 4rem)",
              letterSpacing: "0.35em",
              paddingLeft: "calc(2rem + 0.35em)",
            }}
          >
            {joinCode || "------"}
          </div>
          <div className="mt-6 flex flex-col items-center gap-6">
            <button
              onClick={handleCopyCode}
              disabled={!joinCode}
              className="border border-border px-4 py-3 text-xs tracking-widest uppercase text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? "Copied" : "Copy code"}
            </button>
            <LiveParticipantCount
              count={participantCount}
              caption="in lobby"
              size="lg"
              layout="stack"
              className="w-full max-w-sm"
            />
          </div>
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              onClick={handleStartSession}
              disabled={loadingAction === "start-session"}
              className="btn-primary"
            >
              {loadingAction === "start-session"
                ? "Starting..."
                : "Start Session"}
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
