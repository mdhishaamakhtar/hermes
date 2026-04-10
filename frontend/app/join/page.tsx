"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import MinimalNav from "@/components/MinimalNav";
import {
  getStoredRejoinToken,
  listStoredRejoinTokens,
  storeRejoinToken,
} from "@/lib/session-storage";

export default function JoinPage() {
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    token: string;
  } | null>(null);
  const router = useRouter();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const [storedRejoin] = listStoredRejoinTokens();
    if (!storedRejoin) return;

    const { sessionId, token } = storedRejoin;
    api
      .post<{ status: string }>(
        "/api/sessions/rejoin",
        { sessionId: Number(sessionId), rejoinToken: token },
        { skipAuth: true },
      )
      .then((res) => {
        if (res.success && res.data.status !== "ENDED") {
          setActiveSession({ sessionId, token });
        }
      })
      .catch(() => {});
  }, []);

  interface JoinState {
    error: string;
  }

  const [state, formAction, isPending] = useActionState<JoinState, FormData>(
    async (_) => {
      if (code.length !== 6) {
        return { error: "Enter a 6-character code" };
      }
      if (!displayName.trim()) {
        return { error: "Enter your display name" };
      }
      try {
        const res = await api.post<{
          participantId: number;
          rejoinToken: string;
          sessionId: number;
        }>(
          "/api/sessions/join",
          { joinCode: code.toUpperCase(), displayName: displayName.trim() },
          { skipAuth: true },
        );
        if (res.success) {
          const sessionId = res.data.sessionId;
          const existingToken = getStoredRejoinToken(sessionId);
          if (existingToken) {
            router.push(`/session/${sessionId}/play`);
          } else {
            storeRejoinToken(sessionId, res.data.rejoinToken);
            router.push(`/session/${sessionId}/play`);
          }
          return { error: "" };
        }
        return { error: res.error?.message || "Invalid join code" };
      } catch {
        return { error: "Connection failed" };
      }
    },
    { error: "" },
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MinimalNav />

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        <div className="page-enter w-full max-w-sm">
          {/* Rejoin banner */}
          {activeSession && (
            <div className="page-enter page-enter-delay-1 mb-6 border border-success/30 bg-success/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="label text-success mb-0.5">Session in progress</p>
                <p className="text-xs text-muted">
                  You are already in a session
                </p>
              </div>
              <Link
                href={`/session/${activeSession.sessionId}/play`}
                prefetch
                className="label text-success hover:text-success/80 transition-colors ml-4 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Rejoin →
              </Link>
            </div>
          )}

          <p className="label text-center mb-8">Enter Session Code</p>

          <form action={formAction} className="space-y-6">
            {/* Giant join code input */}
            <div>
              <input
                ref={codeRef}
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6),
                  )
                }
                maxLength={6}
                placeholder="______"
                className="w-full bg-transparent text-center text-foreground font-mono font-bold text-5xl tracking-[0.3em] border-b-2 border-border focus:border-primary focus:outline-none py-4 transition-colors"
                style={{ fontVariantNumeric: "tabular-nums" }}
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              <p className="label text-center opacity-50 mt-2">
                6-character code
              </p>
            </div>

            {/* Display name */}
            <div>
              <label className="field-label block mb-2">Your Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
                maxLength={30}
                required
                placeholder="Display name"
                className="input-field"
              />
            </div>

            {state.error && (
              <p
                className="text-xs text-danger tracking-wide text-center"
                role="alert"
              >
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending || code.length !== 6}
              className="w-full bg-primary text-white py-4 text-sm tracking-widest uppercase font-medium hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isPending ? "Joining..." : "Join Session"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
