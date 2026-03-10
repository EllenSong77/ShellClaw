import { useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../stores/task';
import { useAuthStore } from '../stores/auth';
import { getToken } from '../api/client';
import type { WSEvent } from '../types';

interface UseWebSocketOptions {
  enabled?: boolean;
}

export function useWebSocket({ enabled = true }: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const heartbeatIntervalRef = useRef<number | undefined>(undefined);
  const shouldReconnectRef = useRef(false);

  const handleWSEvent = useTaskStore((state) => state.handleWSEvent);
  const setWsConnected = useTaskStore((state) => state.setWsConnected);
  const wsConnected = useTaskStore((state) => state.wsConnected);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const connect = useCallback(function connectSocket() {
    // Only connect if enabled and authenticated
    if (!enabled || !isAuthenticated) return;
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const token = getToken();
    if (!token) {
      console.log('No token available, skipping WebSocket connection');
      return;
    }

    // Build WebSocket URL with token
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/api/ws?token=${encodeURIComponent(token)}`;

    try {
      shouldReconnectRef.current = true;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);

        // Start heartbeat
        heartbeatIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send('ping');
          }
        }, 30000); // 30 seconds
      };

      socket.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          handleWSEvent(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      socket.onclose = (event) => {
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        console.log('WebSocket disconnected', event.code, event.reason);
        setWsConnected(false);

        // Stop heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = undefined;
        }

        // Attempt to reconnect after 3 seconds if still authenticated
        if (shouldReconnectRef.current && isAuthenticated && enabled) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connectSocket();
          }, 3000);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
    }
  }, [enabled, isAuthenticated, handleWSEvent, setWsConnected]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  }, [setWsConnected]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  // Connect when authenticated, disconnect when not
  useEffect(() => {
    if (isAuthenticated && enabled) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [isAuthenticated, enabled, connect, disconnect]);

  return {
    isConnected: wsConnected,
    disconnect,
    reconnect: connect,
    send,
  };
}
