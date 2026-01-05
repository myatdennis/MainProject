import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSecureAuth } from '../context/SecureAuthContext';
import apiRequest from '../utils/apiClient';
import {
  getOfflineQueueSnapshot,
  initializeOfflineQueue,
  subscribeOfflineQueue,
  type OfflineQueueItem,
} from '../dal/offlineQueue';
import { getSessionMetadata, type SessionMetadata } from '../lib/secureStorage';
import type { ApiError } from '../utils/apiClient';

interface HealthSnapshot {
  healthy: boolean;
  status: 'ok' | 'degraded' | string;
  uptime: number;
  timestamp: string;
  nodeEnv: string;
  version: string | null;
  supabase: {
    status: string;
    disabled?: boolean;
    missingEnvVars?: string[];
    message?: string;
  };
  offlineQueue: {
    status: string;
    backlog?: number;
    message?: string;
  };
  storage: {
    status: string;
    bucket?: string | null;
    missing?: string[];
    message?: string;
  };
  requestId?: string;
}

interface QueueStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  lastItemAt: number | null;
}

const DEBUG_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true';
const STATUS_VARIANTS: Record<string, string> = {
  ok: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30',
  warn: 'bg-amber-500/10 text-amber-200 border-amber-500/30',
  error: 'bg-rose-500/10 text-rose-200 border-rose-500/30',
  disabled: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  info: 'bg-sky-500/10 text-sky-200 border-sky-500/30',
};

const resolveVariant = (status?: string) => {
  const normalized = (status || '').toLowerCase();
  if (['ok', 'healthy', 'connected', 'ready'].includes(normalized)) return 'ok';
  if (['warn', 'warning', 'slow', 'degraded'].includes(normalized)) return 'warn';
  if (['error', 'down', 'failed', 'critical'].includes(normalized)) return 'error';
  if (['disabled', 'missing'].includes(normalized)) return 'disabled';
  return 'info';
};

const summarizeQueue = (items: OfflineQueueItem[]): QueueStats => {
  const total = items.length;
  let high = 0;
  let medium = 0;
  let low = 0;
  let lastItemAt: number | null = null;

  for (const item of items) {
    if (item.priority === 'high') high += 1;
    else if (item.priority === 'medium') medium += 1;
    else low += 1;

    if (!lastItemAt || item.timestamp > lastItemAt) {
      lastItemAt = item.timestamp;
    }
  }

  return {
    total,
    high,
    medium,
    low,
    lastItemAt,
  };
};

const formatDuration = (milliseconds: number): string => {
  if (!Number.isFinite(milliseconds)) return 'n/a';
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

const describeExpiry = (timestamp?: number): string => {
  if (!timestamp) return 'unknown';
  const delta = timestamp - Date.now();
  if (delta <= 0) return 'expired';
  const minutes = delta / 60000;
  if (minutes < 1) return `${Math.round(delta / 1000)}s remaining`;
  if (minutes < 60) return `${Math.round(minutes)}m remaining`;
  return `${(minutes / 60).toFixed(1)}h remaining`;
};

const DevDebugPanel = () => {
  const { user, isAuthenticated, authInitializing } = useSecureAuth();
  const [expanded, setExpanded] = useState(false);
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastHealthAt, setLastHealthAt] = useState<number | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionMetadata | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  const fetchHealth = useCallback(async () => {
    if (!DEBUG_ENABLED) return;
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await apiRequest<HealthSnapshot>('/health', { noTransform: true });
      setHealth(data);
      setLastHealthAt(Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch health';
      setHealthError(message);
      if ((error as ApiError)?.body && typeof (error as ApiError).body === 'object') {
        // Try to surface server-provided metadata for debugging
        const body = (error as ApiError).body as Record<string, any>;
        setHealth(body as HealthSnapshot);
      }
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!DEBUG_ENABLED) return;

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    if (!DEBUG_ENABLED || typeof window === 'undefined') return;

    let unsub: (() => void) | null = null;
    let cancelled = false;

    const setup = async () => {
      try {
        await initializeOfflineQueue();
        if (cancelled) return;
        setQueueStats(summarizeQueue(getOfflineQueueSnapshot()));
        unsub = subscribeOfflineQueue((items) => {
          setQueueStats(summarizeQueue(items));
        });
      } catch (error) {
        console.warn('[DevDebugPanel] Offline queue unavailable:', error);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    if (!DEBUG_ENABLED || typeof window === 'undefined') return;
    setSessionMeta(getSessionMetadata());
  }, [user, isAuthenticated]);

  useEffect(() => {
    if (!DEBUG_ENABLED || typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const uptime = useMemo(() => (health ? formatDuration(health.uptime * 1000) : '—'), [health]);

  if (!DEBUG_ENABLED) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 text-xs font-mono text-slate-200">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="rounded-full border border-slate-700 bg-slate-900/90 px-4 py-1 shadow-lg shadow-slate-900/40 transition hover:border-emerald-400/60"
        >
          {expanded ? 'Hide Dev Panel' : 'Show Dev Panel'}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/95 p-4 shadow-2xl shadow-slate-900/60">
          <header className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Observability</p>
              <p className="text-sm font-semibold text-white">Dev Debug Panel</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400">{isOnline ? 'Online' : 'Offline'}</p>
              <p className="text-[10px] text-slate-500">{health?.requestId || 'no-req-id'}</p>
            </div>
          </header>

          <section className="mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Health</p>
              <button
                type="button"
                onClick={fetchHealth}
                className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-emerald-400/60"
              >
                {healthLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_VARIANTS[resolveVariant(health?.status || undefined)]}`}>
                {health?.status ?? 'unknown'}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_VARIANTS[resolveVariant(health?.supabase?.status)]}`}>
                Supabase: {health?.supabase?.status ?? 'n/a'}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_VARIANTS[resolveVariant(health?.offlineQueue?.status)]}`}>
                Queue: {health?.offlineQueue?.status ?? 'n/a'}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_VARIANTS[resolveVariant(health?.storage?.status)]}`}>
                Storage: {health?.storage?.status ?? 'n/a'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Uptime {uptime} • Updated {lastHealthAt ? `${Math.round((Date.now() - lastHealthAt) / 1000)}s ago` : '—'}
            </p>
            {healthError && <p className="text-[11px] text-rose-300">{healthError}</p>}
          </section>

          <section className="mb-4 border-t border-slate-800 pt-3">
            <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">Session</p>
            <div className="space-y-1 text-[11px] text-slate-300">
              <p>User: <span className="text-white">{user?.email ?? 'Not signed in'}</span></p>
              <p>Role: <span className="text-white">{user?.role ?? '—'}</span></p>
              <p>Org: <span className="text-white">{user?.organizationId ?? '—'}</span></p>
              <p>Auth State: <span className="text-white">{authInitializing ? 'initializing' : JSON.stringify(isAuthenticated)}</span></p>
              <p>Access token: <span className="text-white">{describeExpiry(sessionMeta?.accessExpiresAt)}</span></p>
              <p>Refresh token: <span className="text-white">{describeExpiry(sessionMeta?.refreshExpiresAt)}</span></p>
            </div>
          </section>

          <section className="border-t border-slate-800 pt-3">
            <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">Offline Queue</p>
            <div className="space-y-1 text-[11px] text-slate-300">
              <p>
                Backlog:{' '}
                <span className="text-white">
                  {queueStats?.total ?? 0} items (H:{queueStats?.high ?? 0} M:{queueStats?.medium ?? 0} L:{queueStats?.low ?? 0})
                </span>
              </p>
              <p>
                Server backlog:{' '}
                <span className="text-white">{health?.offlineQueue?.backlog ?? 'n/a'}</span>
              </p>
              <p>
                Last queued:{' '}
                <span className="text-white">
                  {queueStats?.lastItemAt ? new Date(queueStats.lastItemAt).toLocaleTimeString() : '—'}
                </span>
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default DevDebugPanel;
