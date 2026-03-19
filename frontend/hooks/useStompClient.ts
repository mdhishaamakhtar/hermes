"use client";

import { useEffect, useRef, useCallback } from "react";
import { Client, StompSubscription } from "@stomp/stompjs";

interface UseStompOptions {
  headers?: Record<string, string>;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws-hermes";

export function useStompClient(options: UseStompOptions = {}) {
  const clientRef = useRef<Client | null>(null);
  const subscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());
  // Sync options into a ref so the stable effect dep array can still read the
  // latest callbacks without reconnecting on every render.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: optionsRef.current.headers || {},
      reconnectDelay: 3000,
      onConnect: () => {
        optionsRef.current.onConnect?.();
      },
      onDisconnect: () => {
        optionsRef.current.onDisconnect?.();
      },
      onStompError: (frame) => {
        console.error("STOMP error:", frame);
      },
    });

    client.activate();
    clientRef.current = client;

    const subs = subscriptionsRef.current;
    return () => {
      subs.forEach((sub) => sub.unsubscribe());
      subs.clear();
      client.deactivate();
    };
  }, []);

  const subscribe = useCallback(
    (destination: string, callback: (body: unknown) => void) => {
      const client = clientRef.current;
      if (!client || !client.connected) {
        const checkInterval = setInterval(() => {
          if (clientRef.current?.connected) {
            clearInterval(checkInterval);
            const sub = clientRef.current.subscribe(destination, (msg) => {
              try {
                callback(JSON.parse(msg.body));
              } catch {
                callback(msg.body);
              }
            });
            subscriptionsRef.current.set(destination, sub);
          }
        }, 100);
        return;
      }
      const sub = client.subscribe(destination, (msg) => {
        try {
          callback(JSON.parse(msg.body));
        } catch {
          callback(msg.body);
        }
      });
      subscriptionsRef.current.set(destination, sub);
    },
    [],
  );

  const publish = useCallback((destination: string, body: unknown) => {
    const client = clientRef.current;
    if (client?.connected) {
      client.publish({
        destination,
        body: JSON.stringify(body),
      });
    }
  }, []);

  const unsubscribe = useCallback((destination: string) => {
    const sub = subscriptionsRef.current.get(destination);
    if (sub) {
      sub.unsubscribe();
      subscriptionsRef.current.delete(destination);
    }
  }, []);

  return { subscribe, publish, unsubscribe, clientRef };
}
