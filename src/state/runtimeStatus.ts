import { hasSupabaseConfig } from '../lib/supabaseClient';
import { resolveApiUrl } from '../config/apiBase';

export type RuntimeStatus = {
  supabaseConfigured: boolean;
  supabaseHealthy: boolean;
  apiHealthy: boolean;
  apiReachable: boolean;
  apiAuthRequired: boolean;
  wsEnabled: boolean;
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
  apiReachable: true,
  apiAuthRequired: false,
  wsEnabled: false,
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
let connectivityHandlersInstalled = false;

type HealthOverrides = {
  apiReachable?: boolean;
  apiAuthRequired?: boolean;
  lastError?: string;
};

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

const parseHealthResponse = async (response: Response, overrides: HealthOverrides = {}) => {
  let json: any = {};
  try {
    json = await response.json();
  } catch {
    json = {};
  }

  const diagnostics = json && typeof json === 'object' && typeof json.diagnostics === 'object' ? json.diagnostics : json;
  const supabaseStatus = diagnostics?.supabase;
  const realtime = diagnostics?.realtime ?? {};
  const storage = diagnostics?.storage ?? {};
  const offlineQueue = diagnostics?.offlineQueue ?? {};
  const supabaseConfigured =
    typeof supabaseStatus === 'object'
      ? !supabaseStatus?.disabled && (supabaseStatus?.status !== 'disabled' || hasSupabaseConfig)
      : currentStatus.supabaseConfigured;
  const supabaseHealthy =
    typeof supabaseStatus?.status === 'string'
      ? supabaseStatus.status === 'ok'
      : currentStatus.supabaseHealthy;
  const derivedApiHealthy =
    typeof diagnostics?.healthy === 'boolean'
      ? Boolean(diagnostics.healthy)
      : Boolean(diagnostics?.ok ?? response.ok);
  const apiReachable = overrides.apiReachable ?? derivedApiHealthy;
  const apiHealthy = overrides.apiReachable ?? derivedApiHealthy;
  const demoModeEnabled =
    typeof diagnostics?.demoMode?.enabled === 'boolean'
      ? diagnostics.demoMode.enabled
      : diagnostics?.demoModeHealthOverride ?? currentStatus.demoModeEnabled;
  const wsEnabled =
    typeof realtime?.wsEnabled === 'boolean'
      ? realtime.wsEnabled
      : typeof diagnostics?.wsEnabled === 'boolean'
      ? diagnostics.wsEnabled
      : currentStatus.wsEnabled;
  const storageStatus = (storage?.status as RuntimeStatus['storageStatus']) ?? currentStatus.storageStatus;
  const offlineQueueBacklog =
    typeof offlineQueue?.backlog === 'number' ? offlineQueue.backlog : currentStatus.offlineQueueBacklog;
  const statusLabel =
    (diagnostics?.status as RuntimeStatus['statusLabel']) ?? (apiHealthy ? 'ok' : 'degraded');

  currentStatus = {
    supabaseConfigured: supabaseConfigured || hasSupabaseConfig,
    supabaseHealthy: supabaseHealthy || (supabaseConfigured && apiHealthy),
    apiHealthy,
    apiReachable,
    apiAuthRequired: Boolean(overrides.apiAuthRequired),
    demoModeEnabled,
  wsEnabled,
    offlineQueueBacklog,
    storageStatus,
    statusLabel,
    lastChecked: Date.now(),
    requestId: diagnostics?.requestId ?? null,
    lastError: overrides.lastError,
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
    const response = await fetch(resolveApiUrl('/health'), {
      method: 'GET',
      headers: { 'x-runtime-status': '1' },
      credentials: 'include',
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    if (response.ok) {
      const parsed = await parseHealthResponse(response, { apiReachable: true, apiAuthRequired: false });
      return parsed;
    }

    if (response.status === 401 || response.status === 403) {
      const parsed = await parseHealthResponse(response, {
        apiReachable: true,
        apiAuthRequired: true,
      });
      return parsed;
    }

    if (response.status >= 500) {
      throw new Error(`Health request failed (${response.status})`);
    }

    throw new Error(`Health request returned unexpected status (${response.status})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    currentStatus = {
      ...currentStatus,
      apiHealthy: false,
      apiReachable: false,
      apiAuthRequired: false,
      wsEnabled: false,
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

const installConnectivityHandlers = () => {
  if (typeof window === 'undefined' || connectivityHandlersInstalled) return;

  const handleOffline = () => {
    currentStatus = {
      ...currentStatus,
      apiHealthy: false,
      apiReachable: false,
      apiAuthRequired: false,
      wsEnabled: false,
      statusLabel: 'degraded',
      lastChecked: Date.now(),
      lastError: 'offline',
    };
    notify();
  };

  const handleOnline = () => {
    refreshRuntimeStatus().catch((error) => {
      console.warn('[runtimeStatus] connectivity refresh failed:', error);
    });
  };

  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);
  connectivityHandlersInstalled = true;
};

ensureRuntimeStatusPolling();
onResumeForeground();
installConnectivityHandlers();
updateGlobalSnapshot();
