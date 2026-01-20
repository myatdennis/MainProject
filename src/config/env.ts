import { getApiBaseUrl } from './apiBase';

export type AppConfig = {
  apiBaseUrl: string | null;
  features: {
    dalEnabled: boolean;
    sentryEnabled: boolean;
    useAssignmentsApi: boolean;
  };
  timeouts: {
    requestMs: number;
  };
  retries: {
    attempts: number;
    backoffMs: number;
  };
};

const readBoolean = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback;
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
};

export const getConfig = (): AppConfig => {
  const apiBaseUrl = getApiBaseUrl() || null;
  return {
    apiBaseUrl,
    features: {
      dalEnabled: readBoolean((import.meta as any).env?.VITE_FEATURE_DAL_ENABLED, false),
      sentryEnabled: readBoolean((import.meta as any).env?.VITE_SENTRY_ENABLED, false),
      useAssignmentsApi: readBoolean((import.meta as any).env?.VITE_FEATURE_USE_ASSIGNMENTS_API, true),
    },
    timeouts: {
      requestMs: Number((import.meta as any).env?.VITE_REQUEST_TIMEOUT_MS || 15000),
    },
    retries: {
      attempts: Number((import.meta as any).env?.VITE_RETRY_ATTEMPTS || 2),
      backoffMs: Number((import.meta as any).env?.VITE_RETRY_BACKOFF_MS || 300),
    },
  };
};

export const config = getConfig();

if (typeof window !== 'undefined' && typeof console !== 'undefined') {
  const displayBase = config.apiBaseUrl || '/api (proxied via Vite)';
  console.info('[App Config] API base URL:', displayBase);
}
