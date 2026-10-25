"use client";

import { useParams } from "next/navigation";
import { LoadError } from "@/components/LoadError";
import { TopBar } from "@/components/TopBar";
import { SessionLoading } from "@/features/session/components/SessionLoading";
import { useClicker } from "@/features/session/host/useClicker";
import { useHostSession } from "@/features/session/host/useHostSession";
import {
  ScreenEnded,
  ScreenLobby,
  ScreenStage,
  ScreenStandings,
  useStageSounds,
} from "@/features/session/screen/ScreenViews";
import { useWakeLock } from "@/lib/wake-lock";

export default function ScreenPage() {
  const { id } = useParams<{ id: string }>();
  const session = useHostSession(id);
  useWakeLock(session.status !== "ENDED");
  useClicker(session.advance, true, () => {
    if (session.canShowStandings) {
      void session.setScene(
        session.scene === "STANDINGS" ? "QUESTION" : "STANDINGS",
      );
    }
  });
  useStageSounds(session);

  if (session.loadError) {
    return (
      <>
        <TopBar home="/dashboard" width="stage" />
        <main id="main" className="flex flex-1 flex-col">
          <LoadError
            error={session.loadError}
            resource="session"
            back={{ href: "/dashboard", label: "Back to your events" }}
            onRetry={session.retry}
          />
        </main>
      </>
    );
  }
  if (!session.hydrated) return <SessionLoading />;
  if (session.status === "LOBBY") return <ScreenLobby session={session} />;
  if (session.status === "ENDED") return <ScreenEnded session={session} />;
  if (session.scene === "STANDINGS") {
    return <ScreenStandings session={session} />;
  }
  return <ScreenStage session={session} />;
}
