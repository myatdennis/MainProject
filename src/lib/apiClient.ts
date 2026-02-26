import { supabase } from './supabaseClient';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';

export class NotAuthenticatedError extends Error {
  name = 'NotAuthenticatedError';
}

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

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`[apiFetch] supabase.getSession failed: ${error.message}`);
  }
  const token = data?.session?.access_token;
  if (!token) {
    throw new NotAuthenticatedError('[apiFetch] No Supabase session/access_token available');
  }
  return token;
}

async function withAuthHeaders(init: RequestInit = {}, token: string): Promise<RequestInit> {
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);

  const body = init.body;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!headers.has('Content-Type') && body && !isForm) {
    headers.set('Content-Type', 'application/json');
  }

  return { ...init, headers };
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const url = joinUrl(requireApiBase(), path);

  let token = await getAccessToken();
  let requestInit = await withAuthHeaders(init, token);

  let response = await fetch(url, requestInit);

  if (response.status === 401) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw new AuthExpiredError(`[apiFetch] refreshSession failed: ${refreshError.message}`);
    }

    token = refreshed?.session?.access_token ?? '';
    if (!token) {
      throw new AuthExpiredError('[apiFetch] refreshSession returned no access_token');
    }

    requestInit = await withAuthHeaders(init, token);
    response = await fetch(url, requestInit);

    if (response.status === 401) {
      throw new AuthExpiredError('[apiFetch] API still 401 after refresh; treating as logged-out');
    }
  }

  return response;
}

export async function apiJson<T>(path: string, init: RequestInit = {}) {
  const response = await apiFetch(path, init);
  const text = await response.text();

  if (!response.ok) {
    throw new ApiResponseError(response.status, response.statusText, text);
  }

  return (text ? JSON.parse(text) : null) as T;
}
