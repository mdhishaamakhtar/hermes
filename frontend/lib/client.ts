import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * False while rendering on the server and during hydration, true after.
 * Gate anything that reads this device's storage behind it, so the server's
 * render and the first browser render agree.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}
