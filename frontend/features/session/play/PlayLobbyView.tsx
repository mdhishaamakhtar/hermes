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

      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl flex-col items-center justify-center px-4 sm:px-6 py-10">
        <motion.div
          {...enterAnimation}
          className="flex w-full flex-col items-center"
        >
          <p className="label mb-6 text-accent">{sessionTitle}</p>

          <h1 className="text-center text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Waiting for the host
          </h1>

          <p className="mt-5 max-w-md text-center text-sm leading-7 text-muted">
            Your connection is ready. The first question will appear here when
            the host starts the session.
          </p>

          <div className="mt-12 w-full max-w-xs border-t border-border pt-10">
            <LiveParticipantCount
              count={participantCount}
              caption="joined so far"
              size="lg"
              layout="stack"
              className="w-full"
            />
          </div>

          <p className="mt-6 text-center text-xs tracking-wider uppercase text-muted-dark">
            Live session
          </p>
        </motion.div>
      </main>
    </div>
  );
}
