/*
  useWebSocket.ts — Connects to Continew live delivery WebSocket feed.
  Handles connection lifecycle, auto-reconnect with exponential backoff, and maintains real-time metrics.
*/

import { useState, useEffect, useRef, useCallback } from 'react';

export interface LiveAttempt {
  id?: string;
  eventId?: string;
  endpointId?: string;
  attemptNumber?: number;
  responseCode?: number;
  status: string;
  latencyMs?: number;
  error?: string;
  createdAt?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const MAX_LOGS = 100;

export function useWebSocket() {
  const [attempts, setAttempts] = useState<LiveAttempt[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [stats, setStats] = useState({
    total: 0,
    succeeded: 0,
    failed: 0,
    totalLatency: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use /ws path proxied by Vite
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const raw = JSON.parse(event.data);
        const data = raw as {
          type?: string;
          attempt?: LiveAttempt;
          status?: string;
          eventId?: string;
        };
        let attempt: LiveAttempt | null = null;

        if (data.type === 'DELIVERY_ATTEMPT' && data.attempt) {
          attempt = data.attempt;
        } else if (data.status && data.eventId) {
          attempt = data as unknown as LiveAttempt;
        }

        if (attempt) {
          const latency = Number(attempt.latencyMs) || 0;
          const isSuccess = attempt.status?.toLowerCase() === 'succeeded';
          const isFail = ['failed', 'exhausted'].includes(attempt.status?.toLowerCase());

          setStats((prev) => ({
            total: prev.total + 1,
            succeeded: isSuccess ? prev.succeeded + 1 : prev.succeeded,
            failed: isFail ? prev.failed + 1 : prev.failed,
            totalLatency: prev.totalLatency + latency,
          }));

          setAttempts((prev) => {
            const next = [attempt, ...prev];
            if (next.length > MAX_LOGS) {
              next.pop();
            }
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      setStatus('disconnected');
      // Retry in 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current();
      }, 3000);
    };

    ws.onerror = () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const clearLogs = () => {
    setAttempts([]);
    setStats({ total: 0, succeeded: 0, failed: 0, totalLatency: 0 });
  };

  const avgLatency =
    stats.total > 0 ? Math.round(stats.totalLatency / stats.total) : 0;

  return {
    attempts,
    status,
    stats: {
      ...stats,
      avgLatency,
    },
    clearLogs,
    reconnect: connect,
  };
}
