"use client";

import { useParams } from "next/navigation";
import { LoadError } from "@/components/LoadError";
import { TopBar } from "@/components/TopBar";
import { SessionLoading } from "@/features/session/components/SessionLoading";
import {
  HostEnded,
  HostLobby,
  HostStage,
} from "@/features/session/host/HostViews";
import { useHostSession } from "@/features/session/host/useHostSession";

export default function HostPage() {
  const { id } = useParams<{ id: string }>();
  const session = useHostSession(id);

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
  if (session.status === "LOBBY") return <HostLobby session={session} />;
  if (session.status === "ENDED") return <HostEnded session={session} />;
  return <HostStage session={session} />;
}
