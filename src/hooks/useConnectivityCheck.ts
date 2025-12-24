import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface ConnectivitySnapshot {
  isOnline: boolean;
  serverReachable: boolean;
  apiHealthy: boolean;
  roundTripMs: number | null;
  lastError?: string;
  lastChecked: Date;
}

interface ConnectivityOptions {
  /** Optional override for the health endpoint (defaults to /api/health). */
  healthPath?: string;
  /** Polling interval in milliseconds. Default: 30000 */
  intervalMs?: number;
  /** Optional abort signal to pause checks (e.g., when tab hidden). */
  enabled?: boolean;
}

const DEFAULT_SNAPSHOT: ConnectivitySnapshot = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  serverReachable: false,
  apiHealthy: false,
  roundTripMs: null,
  lastChecked: new Date(),
};

export const useConnectivityCheck = ({ healthPath = '/api/health', intervalMs = 30000, enabled = true }: ConnectivityOptions = {}) => {
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>(DEFAULT_SNAPSHOT);
  const timerRef = useRef<number | null>(null);

  const runCheck = useCallback(async () => {
    const startedAt = performance.now();
    const next: ConnectivitySnapshot = {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      serverReachable: false,
      apiHealthy: false,
      roundTripMs: null,
      lastChecked: new Date(),
    };

    if (!next.isOnline) {
      setSnapshot(next);
      return;
    }

    try {
      // Lightweight ping using HEAD so we don't download full HTML
      const ping = await fetch('/', { method: 'HEAD' });
      next.serverReachable = ping.ok;
    } catch (error) {
      next.lastError = error instanceof Error ? error.message : 'Server unreachable';
    }

    try {
      const healthResponse = await fetch(healthPath, { method: 'GET', credentials: 'include' });
      next.apiHealthy = healthResponse.ok;
      next.roundTripMs = Math.round(performance.now() - startedAt);
      if (!healthResponse.ok) {
        next.lastError = `Health endpoint returned ${healthResponse.status}`;
      }
    } catch (error) {
      next.lastError = error instanceof Error ? error.message : 'Health check failed';
    }

    setSnapshot(next);
  }, [healthPath]);

  useEffect(() => {
    if (!enabled) return;
    runCheck();
    timerRef.current = window.setInterval(runCheck, intervalMs);
    const handleOnline = () => runCheck();
    const handleOffline = () => setSnapshot((prev) => ({ ...prev, isOnline: false, serverReachable: false, apiHealthy: false }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, intervalMs, runCheck]);

  const forceCheck = useCallback(() => {
    runCheck();
  }, [runCheck]);

  const status = useMemo(() => {
    if (!snapshot.isOnline) return 'offline';
    if (!snapshot.serverReachable) return 'server-unreachable';
    if (!snapshot.apiHealthy) return 'api-error';
    return 'healthy';
  }, [snapshot.isOnline, snapshot.serverReachable, snapshot.apiHealthy]);

  return { snapshot, forceCheck, status } as const;
};

export default useConnectivityCheck;
