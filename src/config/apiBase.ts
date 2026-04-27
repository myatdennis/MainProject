// src/config/apiBase.ts
// Single canonical API base delegating to src/config/api.ts
// This replaces older, competing logic and ensures all frontend code uses
// the same origin for API calls.

import { API_BASE as CANONICAL_API_BASE } from './api';

const API_BASE_OVERRIDE_KEY = '__APP_API_BASE_OVERRIDE__';
let runtimeApiBaseOverride: string | undefined;

export const __setApiBaseUrlOverride = (value?: string) => {
  const normalized = typeof value === 'string' ? value.trim() : undefined;
  if (typeof globalThis !== 'undefined') {
    if (typeof normalized === 'string') {
      (globalThis as Record<string, any>)[API_BASE_OVERRIDE_KEY] = normalized;
    } else {
      delete (globalThis as Record<string, any>)[API_BASE_OVERRIDE_KEY];
    }
  }
  runtimeApiBaseOverride = normalized;
};

const getRuntimeApiBaseOverride = (): string | undefined => {
  if (typeof globalThis !== 'undefined' && Object.prototype.hasOwnProperty.call(globalThis, API_BASE_OVERRIDE_KEY)) {
    const v = (globalThis as Record<string, any>)[API_BASE_OVERRIDE_KEY];
    if (typeof v === 'string') return v;
  }
  return runtimeApiBaseOverride;
};

// Old granular normalizer removed in favor of a single canonical path normalizer
// that ensures exactly one `/api` prefix for application API routes.
const normalizePath = (input: string) => {
  if (!input) return '/api';
  let path = input;
  // Ensure leading slash
  if (!path.startsWith('/')) path = `/${path}`;

  // If already starts with /api/, treat as normalized
  if (path.startsWith('/api/')) return path;

  // Otherwise prefix a single /api
  return `/api${path}`;
};

const getEffectiveApiBase = (): string => {
  const override = getRuntimeApiBaseOverride();
  const base = (override || CANONICAL_API_BASE).trim();
  // If an override points at a Supabase Functions URL, treat it as invalid
  // for our canonical API base and fall back to the non-functions canonical
  // API base. This prevents routing auth/API calls through Supabase functions
  // hosts.
  try {
    if (typeof base === 'string' && base.includes('supabase.co/functions/v1')) {
      try {
        console.warn('[apiBase] Ignoring Supabase functions URL as API base override and falling back to canonical API base');
      } catch {}
      return CANONICAL_API_BASE.trim();
    }
  } catch {
    // ignore
  }
  return base;
};

export function getApiBaseUrl(): string {
  return getEffectiveApiBase();
}

export function getApiOrigin(): string {
  const base = getEffectiveApiBase();
  try {
    if (/^https?:\/\//i.test(base)) {
      const parsed = new URL(base);
      return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
    }
  } catch {
    // fallthrough
  }
  return '';
}

export const assertNoDoubleApi = (url: string) => {
  if (/\/api\/api(\/|$)/i.test(url)) {
    // Always fail hard — double /api prefixes are a fatal routing bug.
    // Throwing prevents requests from being issued and makes the failure
    // easy to detect in both unit and E2E runs.
    throw new Error('[FATAL] DOUBLE API PREFIX: ' + String(url));
  }
};

export function buildApiUrl(path: string): string {
  // If no path is provided, return the API base (caller expects base URL)
  if (!path) return getApiBaseUrl();

  // Handle absolute URLs first. Block supabase functions URLs early and
  // rewrite them to the canonical API path. Allow other absolute URLs as-is.
  if (/^https?:\/\//i.test(path)) {
    if (path.includes('supabase.co/functions/v1')) {
      // Warn in runtime and map the functions path to our API path
      // by taking the trailing segment after /functions/v1.
      try {
        console.warn('[apiBase] Blocking Supabase functions URL, falling back to API_BASE');
      } catch {}
      const cleanPath = path.split('/functions/v1')[1] || '';
      // Recursively build using the extracted path (e.g. '/auth/login')
      return buildApiUrl(cleanPath);
    }

    // Allow other absolute URLs to pass through untouched.
    return path;
  }

  // Normalized base (no trailing slash)
  const base = getApiBaseUrl().replace(/\/$/, '');

  // Normalize the incoming path to have exactly one `/api` prefix.
  const normalizedPath = normalizePath(path);
  const finalUrl = `${base}${normalizedPath}`;

  // Normalization: collapse accidental /api/api occurrences into a single /api.
  const cleaned = finalUrl.replace(/\/api\/api(\/|$)/i, '/api$1');

  // If supabase functions somehow survived normalization, rewrite them to
  // the canonical API path by stripping the functions/v1 segment.
  if (cleaned.includes('supabase.co/functions/v1')) {
    try {
      console.warn('[apiBase] Rewriting Supabase functions URL to canonical API path');
    } catch {}
    const after = cleaned.split('/functions/v1')[1] || '';
    // Rebuild using the canonical base and normalized path
    const rebuilt = `${base}${normalizePath(after)}`;
    return rebuilt.replace(/\/api\/api(\/|$)/i, '/api$1');
  }

  return cleaned;
}

export const resolveApiUrl = buildApiUrl;

const toWsOrigin = (httpOrigin: string) => {
  if (httpOrigin.startsWith('https://')) return `wss://${httpOrigin.slice('https://'.length)}`;
  if (httpOrigin.startsWith('http://')) return `ws://${httpOrigin.slice('http://'.length)}`;
  return httpOrigin;
};

export function resolveWsUrl(path = '/ws'): string {
  const base = getApiBaseUrl();
  try {
    const parsedBase = new URL(base, typeof window !== 'undefined' ? window.location.origin : undefined);
    const wsOrigin = toWsOrigin(`${parsedBase.protocol}//${parsedBase.host}`);
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${wsOrigin}${normalized}`;
  } catch {
    return `${toWsOrigin(getApiOrigin())}${path}`;
  }
}

