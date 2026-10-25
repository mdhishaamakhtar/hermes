"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/Dialog";

/*
 * Unsaved work, guarded. A form with changes registers itself; while any
 * form has changes, closing or reloading the tab asks first (the browser's
 * own prompt), and following a link inside the app asks with our dialog.
 */
const unsaved = new Set<symbol>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => unsaved.size > 0,
  getServer: () => false,
};

/** Marks the calling form as holding unsaved changes while `dirty` is true. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const key = Symbol("unsaved");
    unsaved.add(key);
    emit();
    return () => {
      unsaved.delete(key);
      emit();
    };
  }, [dirty]);
}

/** Place once on a page whose forms use {@link useUnsavedChanges}. */
export function LeaveGuard() {
  const guarding = useSyncExternalStore(
    store.subscribe,
    store.get,
    store.getServer,
  );
  const router = useRouter();
  const [leavingFor, setLeavingFor] = useState<string | null>(null);

  useEffect(() => {
    if (!guarding) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    // Capture phase on the document runs before the app's own link
    // handling, so a held link never starts navigating.
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setLeavingFor(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [guarding]);

  return (
    <ConfirmDialog
      open={leavingFor !== null}
      onClose={() => setLeavingFor(null)}
      title="Leave without saving?"
      description="The question you're editing hasn't been saved. Leave and it's lost."
      confirmLabel="Leave"
      onConfirm={() => {
        if (!leavingFor) return;
        unsaved.clear();
        emit();
        router.push(leavingFor);
      }}
    />
  );
}
