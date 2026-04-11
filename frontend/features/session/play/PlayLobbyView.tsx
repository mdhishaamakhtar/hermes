"use client";

import { motion } from "framer-motion";
import Logo from "@/components/Logo";
import { LiveParticipantCount } from "@/components/session/LiveParticipantCount";
import { formatParticipantCountPhrase } from "@/lib/session-utils";
import { enterAnimation } from "@/lib/design-tokens";
import { usePlaySession } from "./usePlaySession";

interface Props {
  session: ReturnType<typeof usePlaySession>;
}

export function PlayLobbyView({ session }: Props) {
  const { participantCount, sessionTitle } = session;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 sm:px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <span className="label text-warning">Lobby</span>
            <LiveParticipantCount
              count={participantCount}
              caption={formatParticipantCountPhrase(participantCount)}
              size="sm"
              layout="inline"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl items-center justify-center px-4 sm:px-6 py-10">
        <motion.div
          {...enterAnimation}
          className="w-full border border-border bg-surface px-8 py-10 text-center"
        >
          <p className="label mb-4">{sessionTitle}</p>
          <h1 className="text-3xl font-bold text-foreground">
            Waiting for the host
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted">
            The room is open and your connection is ready. When the host starts
            the timer, the first question will slide into place here.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <span className="label text-accent">Live session</span>
            <LiveParticipantCount
              count={participantCount}
              caption="joined"
              size="lg"
              layout="stack"
              className="w-full max-w-xs"
            />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
