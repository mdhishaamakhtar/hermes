"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Client,
  ReconnectionTimeMode,
  type StompSubscription,
} from "@stomp/stompjs";

interface StompOptions {
  headers?: Record<string, string>;
  onConnect?: () => void;
}

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws-hermes";

// Start aggressive; exponential back-off widens the gap on repeat failures.
const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 5000;
// STOMP heartbeats catch half-open sockets (Wi-Fi to cellular handoffs, iOS
// backgrounding) that would otherwise sit silent until the next publish.
const HEARTBEAT_MS = 10_000;

function parse(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/**
 * One STOMP connection for the life of a session screen. Subscriptions are
 * remembered and replayed on every reconnect, and publishes made while the
 * socket is down are queued and flushed once it is back.
 */
export function useStompClient(options: StompOptions = {}) {
  const clientRef = useRef<Client | null>(null);
  const activeRef = useRef(new Map<string, StompSubscription>());
  const wantedRef = useRef(new Map<string, (body: unknown) => void>());
  const queueRef = useRef<Array<{ destination: string; body: unknown }>>([]);
  const optionsRef = useRef(options);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const active = activeRef.current;
    const client = new Client({
      brokerURL: WS_URL,
      beforeConnect: async () => {
        client.connectHeaders = optionsRef.current.headers ?? {};
      },
      reconnectDelay: INITIAL_RECONNECT_DELAY_MS,
      maxReconnectDelay: MAX_RECONNECT_DELAY_MS,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      heartbeatIncoming: HEARTBEAT_MS,
      heartbeatOutgoing: HEARTBEAT_MS,
      onConnect: () => {
        setConnected(true);
        active.clear();
        wantedRef.current.forEach((callback, destination) => {
          active.set(
            destination,
            client.subscribe(destination, (message) =>
              callback(parse(message.body)),
            ),
          );
        });
        queueRef.current.forEach(({ destination, body }) =>
          client.publish({ destination, body: JSON.stringify(body) }),
        );
        queueRef.current = [];
        optionsRef.current.onConnect?.();
      },
      onDisconnect: () => {
        setConnected(false);
        active.clear();
      },
      onWebSocketClose: () => {
        setConnected(false);
        active.clear();
      },
      onStompError: (frame) => {
        console.error("STOMP error", frame.headers.message, frame.body);
      },
    });

    client.activate();
    clientRef.current = client;

    // Reconnect at once when the page returns to the foreground or the
    // network comes back, instead of waiting out the back-off. iOS Safari
    // closes backgrounded sockets, so every app switch would otherwise stall.
    const reconnectNow = () => {
      if (client.connected) return;
      client.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      void client.deactivate().then(() => client.activate());
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") reconnectNow();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", reconnectNow);
    window.addEventListener("online", reconnectNow);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", reconnectNow);
      window.removeEventListener("online", reconnectNow);
      active.forEach((subscription) => subscription.unsubscribe());
      active.clear();
      void client.deactivate();
    };
  }, []);

  const subscribe = useCallback(
    (destination: string, callback: (body: unknown) => void) => {
      wantedRef.current.set(destination, callback);
      const client = clientRef.current;
      if (!client?.connected || activeRef.current.has(destination)) return;
      activeRef.current.set(
        destination,
        client.subscribe(destination, (message) =>
          callback(parse(message.body)),
        ),
      );
    },
    [],
  );

  const unsubscribe = useCallback((destination: string) => {
    wantedRef.current.delete(destination);
    activeRef.current.get(destination)?.unsubscribe();
    activeRef.current.delete(destination);
  }, []);

  /** True when sent now; false when queued for the next connection. */
  const publish = useCallback((destination: string, body: unknown) => {
    const client = clientRef.current;
    if (client?.connected) {
      client.publish({ destination, body: JSON.stringify(body) });
      return true;
    }
    queueRef.current.push({ destination, body });
    return false;
  }, []);

  return { subscribe, unsubscribe, publish, connected };
}
