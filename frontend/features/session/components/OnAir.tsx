"use client";

import { useSyncExternalStore } from "react";

export type TallyState = "standby" | "on-air" | "off-air";

const TALLY_LABEL: Record<TallyState, string> = {
  standby: "Standby",
  "on-air": "On air",
  "off-air": "Off air",
};

/**
 * The lamp over the camera, and the state of the whole session in one
 * word: standby while the lobby fills, on air while questions run, off air
 * once it is over. Lit only on air.
 */
export function Tally({
  state,
  className = "",
}: {
  state: TallyState;
  className?: string;
}) {
  return (
    <span data-tally={state} className={`tally ${className}`}>
      {TALLY_LABEL[state]}
    </span>
  );
}

function subscribeSeconds(listener: () => void) {
  // Land each tick just after the second turns, so the clock never lags
  // the wall by most of a second.
  let timer = window.setTimeout(
    function tick() {
      listener();
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    },
    1000 - (Date.now() % 1000) + 5,
  );
  return () => window.clearTimeout(timer);
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * The station clock every gallery runs: local time to the second. Rendered
 * only in the browser; the server sends a placeholder of the same width.
 */
export function StationClock({ className = "" }: { className?: string }) {
  const now = useSyncExternalStore(
    subscribeSeconds,
    () => Math.floor(Date.now() / 1000),
    () => null,
  );
  return (
    <span
      aria-hidden
      className={`font-mono text-sm text-muted tabular-nums ${className}`}
    >
      {now === null ? "––:––:––" : timeFormat.format(now * 1000)}
    </span>
  );
}
