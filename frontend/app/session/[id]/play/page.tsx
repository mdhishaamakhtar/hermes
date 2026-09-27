"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SessionLoading } from "@/features/session/components/SessionLoading";
import {
  PlayEnded,
  PlayLobby,
  PlayStage,
  PlayUnavailable,
} from "@/features/session/play/PlayViews";
import { usePlaySession } from "@/features/session/play/usePlaySession";
import { useIsClient } from "@/lib/client";
import { getStoredRejoinToken } from "@/lib/session-storage";

export default function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const isClient = useIsClient();
  // A player is identified by a token on this device, which the server
  // render cannot see; wait for the browser before deciding anything.
  if (!isClient) return <SessionLoading />;
  return <PlayRoot sessionId={id} />;
}

function PlayRoot({ sessionId }: { sessionId: string }) {
  // Read once: a 404 later clears storage, and this screen should then say
  // the session is gone, not that the player never joined.
  const [token] = useState(() => getStoredRejoinToken(sessionId));
  if (!token) return <PlayUnavailable reason="not-joined" />;
  return <PlaySessionScreen sessionId={sessionId} rejoinToken={token} />;
}

function PlaySessionScreen({
  sessionId,
  rejoinToken,
}: {
  sessionId: string;
  rejoinToken: string;
}) {
  const session = usePlaySession(sessionId, rejoinToken);

  // The lobby and the stage are separate screens: open each at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [session.status]);

  if (session.missing) return <PlayUnavailable reason="missing" />;
  if (session.loadError) {
    return <PlayUnavailable reason="unreachable" onRetry={session.retry} />;
  }
  if (!session.hydrated) return <SessionLoading />;
  if (session.status === "LOBBY") {
    return <PlayLobby session={session} sessionId={sessionId} />;
  }
  if (session.status === "ENDED") return <PlayEnded />;
  return <PlayStage session={session} />;
}
