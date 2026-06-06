import { useEffect, useRef, useCallback } from "react";
import { createLiveSocket } from "@services/api";

export function useLiveFeed(onMessage?: (data: Record<string, unknown>) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const callbackRef = useRef(onMessage);

  useEffect(() => {
    callbackRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (wsRef.current) return;
    wsRef.current = createLiveSocket((data) => {
      callbackRef.current?.(data);
    });
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connect, disconnect, connected: wsRef.current?.readyState === WebSocket.OPEN };
}
