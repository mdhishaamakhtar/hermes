"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  message: string | null;
  confirmLabel?: string;
  variant?: "warning" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  message,
  confirmLabel = "Confirm",
  variant = "warning",
  onConfirm,
  onCancel,
}: Props) {
  const isDanger = variant === "danger";
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className={`bg-surface border p-8 max-w-md w-full mx-6 space-y-6 ${
              isDanger ? "border-danger/40" : "border-warning/40"
            }`}
          >
            <p className="text-sm text-foreground leading-relaxed">{message}</p>
            <div className="flex items-center justify-end gap-4">
              <button
                onClick={onCancel}
                className="label text-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`text-white px-5 py-2 text-sm tracking-widest uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isDanger
                    ? "bg-danger hover:bg-danger-hover focus-visible:ring-danger"
                    : "bg-warning hover:bg-warning-hover focus-visible:ring-warning"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
