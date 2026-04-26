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

const stripSlashes = (value: string) => value.replace(/^\/+/, '').replace(/\/+$/, '');

const normalizeResourcePath = (input: string) => {
  if (!input) return { normalizedPath: '', suffix: '' };
  const match = input.match(/^[^?#]*/)?.[0] ?? '';
  const suffix = input.slice(match.length);
  const trimmed = match.replace(/^\/+/, '').replace(/\/+$/, '');
  return { normalizedPath: trimmed ? `/${trimmed}` : '', suffix };
};

const getEffectiveApiBase = (): string => {
  return (getRuntimeApiBaseOverride() || CANONICAL_API_BASE).trim();
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
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV) {
      throw new Error(`[apiBase] Refusing to issue request with double /api prefix: ${url}`);
    }
    console.error(`[apiBase] Detected double /api prefix: ${url}`);
  }
};

export function buildApiUrl(path: string): string {
  if (!path) return getApiBaseUrl();
  if (/^https?:\/\//i.test(path)) {
    assertNoDoubleApi(path);
    return path;
  }
  const base = getApiBaseUrl();
  const { normalizedPath, suffix } = normalizeResourcePath(path || '');
  try {
    const parsedBase = new URL(base, typeof window !== 'undefined' ? window.location.origin : undefined);
    const origin = `${parsedBase.protocol}//${parsedBase.host}`;
    const basePath = parsedBase.pathname && parsedBase.pathname !== '/' ? `/${stripSlashes(parsedBase.pathname)}` : '';
    const finalPath = normalizedPath || basePath || '';
    const url = `${origin}${finalPath}${suffix}`;
    assertNoDoubleApi(url);
    return url;
  } catch {
    const cleanedBase = base.replace(/\/+$/, '');
    const final = `${cleanedBase}${normalizedPath}${suffix}`;
    assertNoDoubleApi(final);
    return final;
  }
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

