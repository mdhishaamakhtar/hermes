/**
 * Keeps a live screen honest while it mixes two sources: REST snapshots
 * (the whole truth at one instant) and STOMP events (the news since).
 *
 * Snapshots are taken often: on connect, whenever the tab comes back, and
 * after every control the host presses. That makes two races ordinary,
 * especially when one browser switches between a host tab and a player tab:
 *
 *  - Several triggers fire together (tab shown, window focused, socket
 *    reconnected), and their responses can land in any order. Calls made
 *    while a snapshot is in flight collapse into one follow-up, so they
 *    cost two requests, not five, and land in order.
 *  - An event can land while a snapshot is in flight, and either may be the
 *    newer. Events carry absolute values, so they are replayed on top of the
 *    snapshot: the result is never older than what the stream has already
 *    said, and the snapshot fills in everything the stream missed.
 */
export interface LiveSync<A> {
  /** Dispatch an action that came from the live stream. */
  event: (action: A) => void;
  /**
   * Fetch and apply a fresh snapshot. Resolves once a snapshot requested
   * after this call has been applied (or has failed).
   */
  resync: () => Promise<void>;
}

/**
 * @param dispatch the screen's reducer dispatch
 * @param load fetches a snapshot and applies it; resolves true if it did
 */
export function createLiveSync<A>(
  dispatch: (action: A) => void,
  load: () => Promise<boolean>,
): LiveSync<A> {
  let running: Promise<void> | null = null;
  let again = false;
  /** Events since the in-flight snapshot was requested, or null if none. */
  let inFlight: A[] | null = null;

  const once = async () => {
    const replay: A[] = [];
    inFlight = replay;
    try {
      if (await load()) replay.forEach(dispatch);
    } catch {
      // `load` reports its own failures; a throw just means nothing applied.
    } finally {
      inFlight = null;
    }
  };

  return {
    event(action) {
      dispatch(action);
      inFlight?.push(action);
    },
    resync() {
      if (running) {
        again = true;
        return running;
      }
      running = (async () => {
        try {
          do {
            again = false;
            await once();
          } while (again);
        } finally {
          running = null;
        }
      })();
      return running;
    },
  };
}
