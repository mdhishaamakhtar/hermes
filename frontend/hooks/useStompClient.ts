"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Client,
  ReconnectionTimeMode,
  StompSubscription,
} from "@stomp/stompjs";

interface UseStompOptions {
  headers?: Record<string, string>;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws-hermes";

// Start aggressive; exponential back-off widens the interval on repeat failures.
const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 5000;
// STOMP-level keep-alive. Detects half-open sockets (cellular → Wi-Fi handoffs,
// iOS backgrounding) that would otherwise sit silent until the next publish.
const HEARTBEAT_MS = 10_000;

export function useStompClient(options: UseStompOptions = {}) {
  const clientRef = useRef<Client | null>(null);
  const connectedRef = useRef(false);
  const subscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());
  const desiredSubscriptionsRef = useRef<Map<string, (body: unknown) => void>>(
    new Map(),
  );
  const publishQueueRef = useRef<Array<{ destination: string; body: unknown }>>(
    [],
  );
  const optionsRef = useRef(options);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const client = new Client({
      brokerURL: WS_URL,
      beforeConnect: async () => {
        client.connectHeaders = optionsRef.current.headers || {};
      },
      reconnectDelay: INITIAL_RECONNECT_DELAY_MS,
      maxReconnectDelay: MAX_RECONNECT_DELAY_MS,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      heartbeatIncoming: HEARTBEAT_MS,
      heartbeatOutgoing: HEARTBEAT_MS,
      onConnect: () => {
        connectedRef.current = true;
        setConnected(true);
        if (process.env.NODE_ENV === "development")
          console.info("[stomp] connected");
        subscriptionsRef.current.clear();
        desiredSubscriptionsRef.current.forEach((callback, destination) => {
          if (!subscriptionsRef.current.has(destination)) {
            const subscription = client.subscribe(destination, (msg) => {
              try {
                callback(JSON.parse(msg.body));
              } catch {
                callback(msg.body);
              }
            });
            subscriptionsRef.current.set(destination, subscription);
          }
        });
        publishQueueRef.current.forEach(({ destination, body }) => {
          client.publish({
            destination,
            body: JSON.stringify(body),
          });
        });
        publishQueueRef.current = [];
        optionsRef.current.onConnect?.();
      },
      onDisconnect: () => {
        connectedRef.current = false;
        setConnected(false);
        if (process.env.NODE_ENV === "development")
          console.info("[stomp] disconnected");
        subscriptionsRef.current.clear();
        optionsRef.current.onDisconnect?.();
      },
      onWebSocketClose: () => {
        connectedRef.current = false;
        setConnected(false);
        if (process.env.NODE_ENV === "development")
          console.info("[stomp] websocket-closed");
        subscriptionsRef.current.clear();
      },
      onStompError: (frame) => {
        console.error("STOMP error:", frame);
      },
    });

    client.activate();
    clientRef.current = client;

    // Force an immediate reconnect when we return to the foreground or the
    // network comes back. stompjs otherwise sits in its reconnectDelay timeout.
    // iOS Safari aggressively closes backgrounded WebSockets, so without this
    // every app-switch eats a full back-off before the client even tries.
    const forceReconnect = () => {
      const c = clientRef.current;
      if (!c) return;
      if (c.connected) return;
      if (process.env.NODE_ENV === "development")
        console.info("[stomp] force-reconnect");
      // Reset to initial delay so a long prior back-off doesn't carry over.
      c.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      // deactivate() cancels the pending reconnect timer; activate() re-queues
      // a connection attempt immediately. Safe to call concurrently per stompjs.
      void c.deactivate().then(() => c.activate());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        forceReconnect();
      }
    };
    const handlePageShow = () => {
      // Covers iOS BFCache restores where visibilitychange may not fire.
      forceReconnect();
    };
    const handleOnline = () => {
      forceReconnect();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("online", handleOnline);

    const subs = subscriptionsRef.current;
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("online", handleOnline);
      subs.forEach((sub) => sub.unsubscribe());
      subs.clear();
      client.deactivate();
    };
  }, []);

  const subscribe = useCallback(
    (destination: string, callback: (body: unknown) => void) => {
      desiredSubscriptionsRef.current.set(destination, callback);
      const client = clientRef.current;
      if (!client?.connected || subscriptionsRef.current.has(destination)) {
        return;
      }
      const subscription = client.subscribe(destination, (msg) => {
        try {
          callback(JSON.parse(msg.body));
        } catch {
          callback(msg.body);
        }
      });
      subscriptionsRef.current.set(destination, subscription);
    },
    [],
  );

  const publish = useCallback((destination: string, body: unknown) => {
    const client = clientRef.current;
    if (process.env.NODE_ENV === "development")
      console.info("[stomp] publish", {
        destination,
        connected: Boolean(client?.connected),
        active: Boolean(client?.active),
      });
    if (client?.connected) {
      client.publish({
        destination,
        body: JSON.stringify(body),
      });
      return true;
    }
    publishQueueRef.current.push({ destination, body });
    return false;
  }, []);

  const unsubscribe = useCallback((destination: string) => {
    desiredSubscriptionsRef.current.delete(destination);
    const subscription = subscriptionsRef.current.get(destination);
    if (subscription) {
      subscription.unsubscribe();
      subscriptionsRef.current.delete(destination);
    }
  }, []);

  return {
    subscribe,
    publish,
    unsubscribe,
    clientRef,
    connectedRef,
    connected,
  };
}
