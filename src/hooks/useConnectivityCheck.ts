import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveApiUrl } from '../config/apiBase';

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

const MIN_SUCCESS_INTERVAL_MS = 60000;
const MAX_BACKOFF_MS = 60000;
const BASE_BACKOFF_MS = 2000;

export const useConnectivityCheck = ({ healthPath = '/api/health', intervalMs = 30000, enabled = true }: ConnectivityOptions = {}) => {
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>(DEFAULT_SNAPSHOT);
  const timeoutRef = useRef<number | null>(null);
  const failureCountRef = useRef(0);
  const enabledRef = useRef(enabled);
  const normalizedSuccessInterval = Math.max(intervalMs ?? MIN_SUCCESS_INTERVAL_MS, MIN_SUCCESS_INTERVAL_MS);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled && timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [enabled]);

  const runCheck = useCallback(async () => {
    if (!enabledRef.current) {
      return;
    }
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
      const ping = await fetch('/', { method: 'HEAD', credentials: 'include' });
      next.serverReachable = ping.ok;
    } catch (error) {
      next.lastError = error instanceof Error ? error.message : 'Server unreachable';
    }

    const targetHealthUrl = /^https?:/i.test(healthPath) ? healthPath : resolveApiUrl(healthPath);

    try {
      const healthResponse = await fetch(targetHealthUrl, { method: 'GET', credentials: 'omit' });
      next.apiHealthy = healthResponse.ok;
      next.roundTripMs = Math.round(performance.now() - startedAt);
      if (!healthResponse.ok) {
        next.lastError = `Health endpoint returned ${healthResponse.status}`;
      }
    } catch (error) {
      next.lastError = error instanceof Error ? error.message : 'Health check failed';
    }

    setSnapshot(next);

    if (!enabledRef.current) {
      return;
    }

    const scheduleNext = (delay: number) => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        runCheck();
      }, delay);
    };

    if (next.apiHealthy) {
      failureCountRef.current = 0;
      scheduleNext(normalizedSuccessInterval);
    } else {
      failureCountRef.current += 1;
      const exponent = Math.max(failureCountRef.current - 1, 0);
      const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** exponent);
      scheduleNext(delay);
    }
  }, [healthPath, normalizedSuccessInterval]);

  useEffect(() => {
    if (!enabled) return undefined;
    failureCountRef.current = 0;
    runCheck();
    const handleOnline = () => runCheck();
    const handleOffline = () =>
      setSnapshot((prev) => ({ ...prev, isOnline: false, serverReachable: false, apiHealthy: false }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, runCheck]);

  const forceCheck = useCallback(() => {
    failureCountRef.current = 0;
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
