// src/config/apiBase.ts
const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() || '';
const RAW_WS_URL = import.meta.env.VITE_WS_URL?.trim() || '';
const RAW_API_PATH = import.meta.env.VITE_API_PATH_PREFIX?.trim();

const isBrowser = typeof window !== 'undefined';
const DEFAULT_NODE_ORIGIN = 'http://localhost:8888';

const readNodeEnv = (key: string) => (typeof process !== 'undefined' ? process.env?.[key]?.trim() : undefined);
const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const ensureLeadingSlash = (value: string) => (value.startsWith('/') ? value : `/${value}`);

const normalizePathPrefix = (value?: string) => {
  if (!value || value === '/') return '';
  return ensureLeadingSlash(value.replace(/^\/+/, '').replace(/\/+$/, ''));
};

const extractEnvBase = () => {
  if (!RAW_API_BASE) return { origin: '', pathPrefix: '' };
  try {
    const parsed = new URL(RAW_API_BASE);
    const origin = `${parsed.protocol}//${parsed.host}`;
    const pathPrefix = parsed.pathname && parsed.pathname !== '/' ? normalizePathPrefix(parsed.pathname) : '';
    return { origin: trimTrailingSlash(origin), pathPrefix };
  } catch {
    return { origin: trimTrailingSlash(RAW_API_BASE), pathPrefix: '' };
  }
};

const ENV_BASE = extractEnvBase();
const API_PATH_PREFIX = ENV_BASE.pathPrefix || normalizePathPrefix(RAW_API_PATH || '/api');

const getBrowserOrigin = () => {
  if (!isBrowser) return '';
  if (typeof window !== 'undefined' && window.location?.origin) {
    return trimTrailingSlash(window.location.origin);
  }
  return '';
};

const getNodeOrigin = () => {
  const fromEnv = readNodeEnv('API_ORIGIN') || readNodeEnv('API_BASE_URL');
  if (fromEnv) return trimTrailingSlash(fromEnv);
  return trimTrailingSlash(DEFAULT_NODE_ORIGIN);
};

export function getApiOrigin(): string {
  if (ENV_BASE.origin) return ENV_BASE.origin;
  const browserOrigin = getBrowserOrigin();
  if (browserOrigin) return browserOrigin;
  return getNodeOrigin();
}

export function getApiBaseUrl(): string {
  const origin = getApiOrigin();
  return API_PATH_PREFIX ? `${origin}${API_PATH_PREFIX}` : origin;
}

const splitPathAndSuffix = (input: string) => {
  if (!input) return { path: '', suffix: '' };
  const match = input.match(/^[^?#]*/)?.[0] ?? '';
  const suffix = input.slice(match.length);
  return { path: match, suffix };
};

const normalizeResourcePath = (input: string) => {
  const { path, suffix } = splitPathAndSuffix(input);
  const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '');
  const normalizedPath = trimmed ? `/${trimmed}` : '';
  return { normalizedPath, suffix };
};

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const origin = getApiOrigin();
  const base = getApiBaseUrl();
  const { normalizedPath, suffix } = normalizeResourcePath(path);

  if (!normalizedPath) {
    return `${base}${suffix}`;
  }

  if (API_PATH_PREFIX && normalizedPath.startsWith(API_PATH_PREFIX)) {
    return `${origin}${normalizedPath}${suffix}`;
  }

  if (API_PATH_PREFIX) {
    return `${origin}${API_PATH_PREFIX}${normalizedPath}${suffix}`;
  }

  return `${origin}${normalizedPath}${suffix}`;
}

const toWsOrigin = (httpOrigin: string) => {
  if (httpOrigin.startsWith('https://')) return `wss://${httpOrigin.slice('https://'.length)}`;
  if (httpOrigin.startsWith('http://')) return `ws://${httpOrigin.slice('http://'.length)}`;
  return httpOrigin;
};

export function resolveWsUrl(path = '/ws'): string {
  if (/^wss?:\/\//i.test(path || '')) {
    return path as string;
  }
  const { normalizedPath, suffix } = normalizeResourcePath(path || '/ws');
  const finalPath = normalizedPath || '/ws';

  if (RAW_WS_URL) {
    return RAW_WS_URL;
  }

  if (!isBrowser) {
    const nodeWs = readNodeEnv('WS_URL');
    if (nodeWs) {
      return nodeWs;
    }
  }

  const wsOrigin = toWsOrigin(getApiOrigin());
  return `${wsOrigin}${finalPath}${suffix}`;
}

