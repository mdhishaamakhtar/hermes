"use client";

import { useParams } from "next/navigation";
import { SessionPageSkeleton } from "@/components/PageSkeleton";
import { usePlaySession } from "@/features/session/play/usePlaySession";
import { PlayLobbyView } from "@/features/session/play/PlayLobbyView";
import { PlayEndedView } from "@/features/session/play/PlayEndedView";
import { PlayLiveView } from "@/features/session/play/PlayLiveView";

export default function PlayPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const session = usePlaySession(sessionId);

  if (!session.hydrated) return <SessionPageSkeleton />;
  if (session.sessionState === "LOBBY")
    return <PlayLobbyView session={session} />;
  if (session.sessionState === "ENDED") return <PlayEndedView />;
  return <PlayLiveView session={session} />;
}
