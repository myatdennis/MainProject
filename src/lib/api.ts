import { apiFetch } from './apiClient';

export type LegacyApiOptions = RequestInit & {
  timeoutMs?: number;
  requestLabel?: string;
};

const isSerializableBody = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return !(value instanceof FormData || value instanceof Blob || value instanceof ArrayBuffer);
};

/**
 * Lightweight compatibility wrapper used across the app as `api`.
 * Maintains the previous fetch-like shape while ensuring Supabase auth headers
 * are always attached via apiFetch/authorizedFetch.
 */
export const api = async (path: string, options: LegacyApiOptions = {}) => {
  const { timeoutMs, requestLabel, body, headers, ...rest } = options;
  const nextHeaders = new Headers(headers);
  let resolvedBody: BodyInit | undefined = body as BodyInit | undefined;

  if (body != null && isSerializableBody(body)) {
    resolvedBody = JSON.stringify(body);
    if (!nextHeaders.has('Content-Type')) {
      nextHeaders.set('Content-Type', 'application/json');
    }
  }

  return apiFetch(
    path,
    {
      ...rest,
      headers: nextHeaders,
      body: resolvedBody,
    },
    {
      timeoutMs,
      requestLabel,
    },
  );
};

export default api;
