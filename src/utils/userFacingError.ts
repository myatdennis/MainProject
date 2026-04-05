import { ApiError } from './apiClient';

type ErrorResolutionOptions = {
  fallback: string;
  action?: string;
};

const extractMessage = (error: unknown): string | null => {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (!(error instanceof Error)) return null;

  if (error instanceof ApiError) {
    const body = error.body && typeof error.body === 'object' ? (error.body as Record<string, unknown>) : null;
    const fromBody = [body?.message, body?.error, body?.detail].find((value) => typeof value === 'string') as
      | string
      | undefined;
    if (fromBody) return fromBody;
  }

  return error.message || null;
};

const isConnectivityFailure = (error: unknown): boolean => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  if (error instanceof ApiError) {
    return error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504;
  }

  if (error instanceof Error) {
    return /network|failed to fetch|timeout/i.test(error.message);
  }

  return false;
};

export const resolveUserFacingError = (error: unknown, options: ErrorResolutionOptions): string => {
  if (isConnectivityFailure(error)) {
    return `You're offline or the service is unavailable. ${options.action ?? 'Please try again in a moment.'}`;
  }

  const extracted = extractMessage(error);
  if (extracted && extracted.trim()) {
    return extracted.trim();
  }

  return options.fallback;
};
