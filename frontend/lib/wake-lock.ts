"use client";

import { useEffect } from "react";

/**
 * Keeps the display awake while a live screen is open. A projector laptop
 * that dims mid-question, or a host's phone that locks between questions,
 * costs the room its place. The browser drops the lock whenever the tab is
 * hidden, so it is taken again each time the tab comes back.
 */
export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) void next.release();
        else sentinel = next;
      } catch {
        // Refused (battery saver, an unsupported frame): the screen may sleep.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, [active]);
}
