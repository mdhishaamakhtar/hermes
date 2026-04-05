"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  message: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
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
            className="bg-surface border border-warning/40 p-8 max-w-md w-full mx-6 space-y-6"
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
                className="bg-warning text-white px-5 py-2 text-sm tracking-widest uppercase hover:bg-warning-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Abandon
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
