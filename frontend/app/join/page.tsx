"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import MinimalNav from "@/components/MinimalNav";
import Link from "next/link";

export default function JoinPage() {
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    token: string;
  } | null>(null);
  const router = useRouter();
  const codeRef = useRef<HTMLInputElement>(null);

  // On mount, scan localStorage for any existing rejoin tokens
  useEffect(() => {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("hermes_rejoin_"),
    );
    if (keys.length === 0) return;
    for (const key of keys) {
      const token = localStorage.getItem(key);
      const sessionId = key.replace("hermes_rejoin_", "");
      if (token) {
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
        break;
      }
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter a 6-character code");
      return;
    }
    if (!displayName.trim()) {
      setError("Enter your display name");
      return;
    }
    setError("");
    setLoading(true);
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
        const existingToken = localStorage.getItem(
          `hermes_rejoin_${sessionId}`,
        );
        if (existingToken) {
          router.push(`/session/${sessionId}/play`);
        } else {
          localStorage.setItem(
            `hermes_rejoin_${sessionId}`,
            res.data.rejoinToken,
          );
          router.push(`/session/${sessionId}/play`);
        }
      } else {
        setError(res.error?.message || "Invalid join code");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scanlines min-h-screen bg-background flex flex-col">
      <MinimalNav />

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm"
        >
          {/* Rejoin banner */}
          <AnimatePresence>
            {activeSession && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 border border-success/30 bg-success/5 px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="label text-success mb-0.5">Session in progress</p>
                  <p className="text-xs text-muted">You are already in a session</p>
                </div>
                <button
                  onClick={() => router.push(`/session/${activeSession.sessionId}/play`)}
                  className="label text-success hover:text-success/80 transition-colors ml-4 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Rejoin →
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="label text-center mb-8">Enter Session Code</p>

          <form onSubmit={handleSubmit} className="space-y-6">
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
              <p className="label text-center opacity-50 mt-2">6-character code</p>
            </div>

            {/* Display name */}
            <div>
              <label className="label block mb-2">Your Name</label>
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

            {error && (
              <p className="text-xs text-danger tracking-wide text-center" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-primary text-white py-4 text-sm tracking-widest uppercase font-medium hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{
                boxShadow: code.length === 6 ? "0 0 20px rgba(37,99,235,0.3)" : "none",
              }}
            >
              {loading ? "Joining..." : "Join Session"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
