"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { describeError } from "@/lib/api";
import { storeJoinCode } from "@/lib/session-storage";
import { sessionsApi } from "../session-api";

/** Opens a fresh lobby for the same quiz and takes the host to it. */
export function RunAgainButton({
  quizId,
  variant = "primary",
}: {
  quizId: number;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant={variant}
      icon="play"
      pending={pending}
      onClick={async () => {
        setPending(true);
        try {
          const session = await sessionsApi.create(quizId);
          storeJoinCode(session.id, session.joinCode);
          router.push(`/session/${session.id}/host`);
        } catch (err) {
          toast.error(describeError(err, "Couldn't open a new lobby."));
          setPending(false);
        }
      }}
    >
      {pending ? "Opening lobby…" : "Run again"}
    </Button>
  );
}
