"use client";

import { useParams } from "next/navigation";
import { SessionPageSkeleton } from "@/components/PageSkeleton";
import { useHostSession } from "@/features/session/host/useHostSession";
import { HostLobbyView } from "@/features/session/host/HostLobbyView";
import { HostEndedView } from "@/features/session/host/HostEndedView";
import { HostLiveView } from "@/features/session/host/HostLiveView";

export default function HostPage() {
  const { id } = useParams<{ id: string }>();
  const session = useHostSession(id);

  if (!session.hydrated) return <SessionPageSkeleton />;
  if (session.sessionStatus === "LOBBY")
    return <HostLobbyView session={session} />;
  if (session.sessionStatus === "ENDED")
    return <HostEndedView id={id} session={session} />;
  return <HostLiveView session={session} />;
}
