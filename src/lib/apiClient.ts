import authorizedFetch from './authorizedFetch';
export { NotAuthenticatedError } from './authorizedFetch';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';

export class AuthExpiredError extends Error {
  name = 'AuthExpiredError';
}

export class ApiResponseError extends Error {
  status: number;
  body: string;

  constructor(status: number, statusText: string, body: string) {
    super(`[apiJson] ${status} ${statusText}`);
    this.name = 'ApiResponseError';
    this.status = status;
    this.body = body;
  }
}

function requireApiBase(): string {
  if (!API_BASE) {
    throw new Error('[apiFetch] Missing VITE_API_BASE_URL');
  }
  return API_BASE;
}

function joinUrl(base: string, path: string) {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

type ApiFetchOptions = {
  timeoutMs?: number;
  requestLabel?: string;
};

export async function apiFetch(path: string, init: RequestInit = {}, options: ApiFetchOptions = {}) {
  const url = joinUrl(requireApiBase(), path);
  const response = await authorizedFetch(
    url,
    init,
    {
      requireAuth: true,
      timeoutMs: typeof options.timeoutMs === 'number' ? options.timeoutMs : undefined,
      requestLabel: options.requestLabel ?? path,
    },
  );

  if (response.status === 401) {
    throw new AuthExpiredError('[apiFetch] API still 401 after refresh; treating as logged-out');
  }

  return response;
}

export async function apiJson<T>(path: string, init: RequestInit = {}, options: ApiFetchOptions = {}) {
  const response = await apiFetch(path, init, options);
  const text = await response.text();

  if (!response.ok) {
    throw new ApiResponseError(response.status, response.statusText, text);
  }

  return (text ? JSON.parse(text) : null) as T;
}
