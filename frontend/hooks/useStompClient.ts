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
  const desiredSubscriptionsRef = useRef<Map<string, (body: unknown) => void>>(
    new Map(),
  );
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const client = new Client({
      brokerURL: WS_URL,
      beforeConnect: async () => {
        client.connectHeaders = optionsRef.current.headers || {};
      },
      reconnectDelay: 3000,
      onConnect: () => {
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
        optionsRef.current.onConnect?.();
      },
      onDisconnect: () => {
        subscriptionsRef.current.clear();
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
    if (client?.connected) {
      client.publish({
        destination,
        body: JSON.stringify(body),
      });
    }
  }, []);

  const unsubscribe = useCallback((destination: string) => {
    desiredSubscriptionsRef.current.delete(destination);
    const subscription = subscriptionsRef.current.get(destination);
    if (subscription) {
      subscription.unsubscribe();
      subscriptionsRef.current.delete(destination);
    }
  }, []);

  return { subscribe, publish, unsubscribe, clientRef };
}
