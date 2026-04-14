"use client";

import { AnimatePresence, motion } from "framer-motion";

// Rendered in session headers. Silent when the WebSocket is live, visibly
// amber when reconnecting so users (host and participants alike) know the UI
// may be briefly stale — mostly relevant on mobile when the OS closes the
// socket on app-switch.
export function ConnectionStatusBadge({ connected }: { connected: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {connected ? null : (
        <motion.span
          key="reconnecting"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="inline-flex items-center gap-2 border border-warning/30 bg-warning/8 px-2 py-1 text-[11px] tracking-[0.18em] uppercase text-warning"
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-warning"
            style={{ animation: "pulse-dot 1.5s ease-in-out infinite" }}
          />
          Reconnecting
        </motion.span>
      )}
    </AnimatePresence>
  );
}
