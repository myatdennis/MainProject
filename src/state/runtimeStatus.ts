import { hasSupabaseConfig } from '../lib/supabaseClient';

export type RuntimeStatus = {
  supabaseConfigured: boolean;
  supabaseHealthy: boolean;
  apiHealthy: boolean;
  demoModeEnabled: boolean;
  offlineQueueBacklog: number | null;
  storageStatus: 'ok' | 'warn' | 'disabled' | 'unknown';
  statusLabel: 'ok' | 'degraded' | 'demo-fallback' | 'unknown';
  lastChecked: number | null;
  requestId?: string | null;
  lastError?: string | null;
};

type RuntimeListener = (status: RuntimeStatus) => void;

const DEFAULT_STATUS: RuntimeStatus = {
  supabaseConfigured: hasSupabaseConfig,
  supabaseHealthy: hasSupabaseConfig,
  apiHealthy: true,
  demoModeEnabled: false,
  offlineQueueBacklog: null,
  storageStatus: 'unknown',
  statusLabel: 'unknown',
  lastChecked: null,
  requestId: null,
  lastError: undefined,
};

let currentStatus: RuntimeStatus = { ...DEFAULT_STATUS };
const listeners = new Set<RuntimeListener>();
let pollingHandle: number | null = null;
let inflightRefresh: Promise<RuntimeStatus> | null = null;

const updateGlobalSnapshot = () => {
  if (typeof window === 'undefined') return;
  (window as any).__APP_RUNTIME_STATUS__ = currentStatus;
};

const notify = () => {
  updateGlobalSnapshot();
  listeners.forEach((listener) => {
    try {
      listener(currentStatus);
    } catch (error) {
      console.warn('[runtimeStatus] listener threw', error);
    }
  });
};

const parseHealthResponse = async (response: Response) => {
  const json = await response.json();
  const supabaseStatus = json?.supabase ?? {};
  const storage = json?.storage ?? {};
  const offlineQueue = json?.offlineQueue ?? {};
  const supabaseConfigured = !supabaseStatus?.disabled && (supabaseStatus?.status !== 'disabled' || hasSupabaseConfig);
  const supabaseHealthy = supabaseStatus?.status === 'ok';
  const apiHealthy = Boolean(json?.healthy);
  const demoModeEnabled = Boolean(json?.demoMode?.enabled || json?.demoModeHealthOverride);
  const statusLabel = (json?.status as RuntimeStatus['statusLabel']) || (apiHealthy ? 'ok' : 'degraded');

  currentStatus = {
    supabaseConfigured: supabaseConfigured || hasSupabaseConfig,
    supabaseHealthy: supabaseHealthy || (supabaseConfigured && apiHealthy),
    apiHealthy,
    demoModeEnabled,
    offlineQueueBacklog: typeof offlineQueue?.backlog === 'number' ? offlineQueue.backlog : null,
    storageStatus: (storage?.status as RuntimeStatus['storageStatus']) ?? 'unknown',
    statusLabel,
    lastChecked: Date.now(),
    requestId: json?.requestId ?? null,
    lastError: undefined,
  };

  return currentStatus;
};

export const getRuntimeStatus = (): RuntimeStatus => currentStatus;

export const isSupabaseOperational = (): boolean => {
  const status = getRuntimeStatus();
  return status.supabaseConfigured && status.supabaseHealthy;
};

export const subscribeRuntimeStatus = (listener: RuntimeListener): (() => void) => {
  listeners.add(listener);
  listener(currentStatus);
  return () => listeners.delete(listener);
};

const performRefresh = async (): Promise<RuntimeStatus> => {
  if (typeof window === 'undefined') {
    currentStatus = { ...currentStatus, supabaseConfigured: hasSupabaseConfig };
    return currentStatus;
  }

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    const response = await fetch('/api/health', {
      method: 'GET',
      headers: { 'x-runtime-status': '1' },
      credentials: 'include',
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(`Health request failed (${response.status})`);
    }
    const parsed = await parseHealthResponse(response);
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    currentStatus = {
      ...currentStatus,
      apiHealthy: false,
      supabaseHealthy: currentStatus.supabaseHealthy && hasSupabaseConfig,
      statusLabel: 'degraded',
      lastChecked: Date.now(),
      lastError: message,
    };
    return currentStatus;
  } finally {
    notify();
  }
};

export const refreshRuntimeStatus = (): Promise<RuntimeStatus> => {
  if (!inflightRefresh) {
    inflightRefresh = performRefresh().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
};

export const ensureRuntimeStatusPolling = () => {
  if (typeof window === 'undefined') return;
  if (pollingHandle !== null) return;
  refreshRuntimeStatus().catch((error) => {
    console.warn('[runtimeStatus] initial refresh failed:', error);
  });
  pollingHandle = window.setInterval(() => {
    refreshRuntimeStatus().catch((error) => {
      console.warn('[runtimeStatus] periodic refresh failed:', error);
    });
  }, 30000);
};

export const onResumeForeground = () => {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshRuntimeStatus().catch((error) => {
        console.warn('[runtimeStatus] visibility refresh failed:', error);
      });
    }
  });
};

ensureRuntimeStatusPolling();
onResumeForeground();
updateGlobalSnapshot();
