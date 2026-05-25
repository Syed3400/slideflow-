"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type PresentationSocketEvent = {
  event: string;
  version: number;
  timestamp: string;
  presentationId: string;
  ownerId: string;
  data: Record<string, unknown>;
};

function toWsUrl(baseHttpUrl: string) {
  if (baseHttpUrl.startsWith("https://")) {
    return baseHttpUrl.replace("https://", "wss://");
  }
  if (baseHttpUrl.startsWith("http://")) {
    return baseHttpUrl.replace("http://", "ws://");
  }
  return baseHttpUrl;
}

type Options = {
  presentationId: string;
  ownerId?: string;
  enabled?: boolean;
};

export function usePresentationEvents({ presentationId, ownerId, enabled = true }: Options) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<PresentationSocketEvent | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wsUrl = useMemo(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsBase = toWsUrl(apiUrl);
    const ownerQuery = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : "";
    return `${wsBase}/ws/presentation/${presentationId}${ownerQuery}`;
  }, [presentationId, ownerId]);

  useEffect(() => {
    if (!enabled || !presentationId) {
      return;
    }

    let cancelled = false;

    const cleanupSocket = () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) {
        return;
      }
      const delay = Math.min(1000 * 2 ** retryCountRef.current, 15000);
      retryCountRef.current += 1;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    const connect = () => {
      cleanupSocket();
      try {
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (cancelled) {
            return;
          }
          retryCountRef.current = 0;
          setIsConnected(true);
          setConnectionError(null);
        };

        socket.onmessage = (message) => {
          if (cancelled) {
            return;
          }
          if (message.data === "ping") {
            socket.send("ping");
            return;
          }
          try {
            const parsed: PresentationSocketEvent = JSON.parse(String(message.data));
            setLastEvent(parsed);
          } catch {
            // Ignore malformed events from stale servers.
          }
        };

        socket.onerror = () => {
          if (!cancelled) {
            setConnectionError("Unable to connect to live updates.");
          }
        };

        socket.onclose = () => {
          if (cancelled) {
            return;
          }
          setIsConnected(false);
          scheduleReconnect();
        };
      } catch {
        setConnectionError("Unable to open live updates.");
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      cleanupSocket();
    };
  }, [enabled, presentationId, wsUrl]);

  return {
    isConnected,
    lastEvent,
    connectionError,
  };
}
