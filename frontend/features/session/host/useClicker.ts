"use client";

import { useEffect, useEffectEvent } from "react";

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * A presenter's clicker sends → or Page Down for "next". Bound on both of
 * the host's screens, so the show runs from whichever one the clicker is
 * plugged into. Key repeats and keys typed into a field are ignored, and
 * `advance` decides for itself whether there is a next step right now.
 */
export function useClicker(
  advance: () => void,
  enabled = true,
  /** S puts the standings up on the big screen, or takes them down. */
  toggleStandings?: () => void,
) {
  const onAdvance = useEffectEvent(advance);
  const onStandings = useEffectEvent(() => toggleStandings?.());
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || isEditable(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        onAdvance();
      } else if (event.key === "s" || event.key === "S") {
        onStandings();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
