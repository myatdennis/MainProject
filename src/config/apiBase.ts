// src/config/apiBase.ts
type MetaEnv = Record<string, string | undefined>;

const API_BASE_OVERRIDE_KEY = '__APP_API_BASE_OVERRIDE__';
let runtimeApiBaseOverride: string | undefined;

const getRuntimeApiBaseOverride = (): string | undefined => {
  if (typeof globalThis !== 'undefined' && Object.prototype.hasOwnProperty.call(globalThis, API_BASE_OVERRIDE_KEY)) {
    const value = (globalThis as Record<string, any>)[API_BASE_OVERRIDE_KEY];
    if (typeof value === 'string') {
      return value;
    }
  }
  return runtimeApiBaseOverride;
};

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

const getMetaEnv = (): MetaEnv => {
  const env = (import.meta as any)?.env;
  if (env && typeof env === 'object') {
    return env as MetaEnv;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env as MetaEnv;
  }
  return {} as MetaEnv;
};

const DEFAULT_DEV_API_BASE = '/api';
const DEFAULT_NODE_ORIGIN = 'http://localhost:8888';

const detectDevMode = () => {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
    return Boolean((import.meta as any).env.DEV);
  }
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV !== 'production';
  }
  return true;
};

const devMode = detectDevMode();

const logMissingEnv = (() => {
  const seen = new Set<string>();
  return (envName: string, details?: string) => {
    if (seen.has(envName)) return;
    seen.add(envName);
    const suffix = details ? ` ${details}` : '';
    console.error(`[apiBase] Missing ${envName}.${suffix}`);
  };
})();

const getRawApiBase = (): string => {
  const override = getRuntimeApiBaseOverride();
  if (typeof override === 'string') {
    return override;
  }
  const value = getMetaEnv().VITE_API_BASE_URL;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed) {
    return trimmed;
  }
  const fallback = devMode ? DEFAULT_DEV_API_BASE : '';
  logMissingEnv(
    'VITE_API_BASE_URL',
    fallback ? 'Falling back to /api proxy because no production value is configured.' : 'Configure it to point at https://api.the-huddle.co.',
  );
  return fallback;
};

const getRawWsUrl = (): string => {
  const value = getMetaEnv().VITE_WS_URL;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    if (devMode) {
      logMissingEnv('VITE_WS_URL', 'Realtime is disabled unless VITE_WS_URL is defined. Falling back only in dev.');
    } else {
      logMissingEnv('VITE_WS_URL', 'Realtime will be disabled until this is set (e.g., wss://api.the-huddle.co/ws).');
    }
  }
  return trimmed;
};

const getRawApiPath = (): string | undefined => {
  const value = getMetaEnv().VITE_API_PATH_PREFIX;
  return typeof value === 'string' ? value.trim() : undefined;
};

const isBrowser = typeof window !== 'undefined';

const readNodeEnv = (key: string) => (typeof process !== 'undefined' ? process.env?.[key]?.trim() : undefined);
const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const ensureLeadingSlash = (value: string) => (value.startsWith('/') ? value : `/${value}`);

const normalizePathPrefix = (value?: string) => {
  if (!value || value === '/') return '';
  return ensureLeadingSlash(value.replace(/^\/+/, '').replace(/\/+$/, ''));
};

const extractEnvBase = (rawBase: string) => {
  if (!rawBase) return { origin: '', pathPrefix: '' };

  const trimmed = rawBase.trim();
  const isAbsolute = /^https?:\/\//i.test(trimmed);
  const isRelativePath = !isAbsolute && trimmed.startsWith('/') && !trimmed.startsWith('//');

  if (isAbsolute) {
    try {
      const parsed = new URL(trimmed);
      const origin = `${parsed.protocol}//${parsed.host}`;
      const pathPrefix = parsed.pathname && parsed.pathname !== '/' ? normalizePathPrefix(parsed.pathname) : '';
      return { origin: trimTrailingSlash(origin), pathPrefix };
    } catch {
      return { origin: trimTrailingSlash(trimmed), pathPrefix: '' };
    }
  }

  if (isRelativePath) {
    return { origin: '', pathPrefix: normalizePathPrefix(trimmed) };
  }

  return { origin: trimTrailingSlash(trimmed), pathPrefix: '' };
};

const getEnvBase = () => extractEnvBase(getRawApiBase());
const getApiPathPrefix = () => {
  const envBase = getEnvBase();
  return envBase.pathPrefix || normalizePathPrefix(getRawApiPath() || '/api');
};

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
  const envBase = getEnvBase();
  if (envBase.origin) return envBase.origin;
  const browserOrigin = getBrowserOrigin();
  if (browserOrigin) return browserOrigin;
  return getNodeOrigin();
}

export function getApiBaseUrl(): string {
  const origin = getApiOrigin();
  const pathPrefix = getApiPathPrefix();
  return pathPrefix ? `${origin}${pathPrefix}` : origin;
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

const shouldWarnDoubleApi = (() => {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
    return Boolean((import.meta as any).env.DEV);
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV !== 'production';
  }
  return false;
})();
const logDoubleApi = (url: string) => {
  const message = `[apiBase] Detected double /api prefix: ${url}`;
  if (shouldWarnDoubleApi) {
    console.warn(message);
  } else {
    console.error(message);
  }
};

export const assertNoDoubleApi = (url: string) => {
  if (/\/api\/api(\/|$)/i.test(url)) {
    logDoubleApi(url);
    if (shouldWarnDoubleApi) {
      throw new Error(`[apiBase] Refusing to issue request with double /api prefix: ${url}`);
    }
  }
};

const stripSlashes = (value: string) => value.replace(/^\/+/, '').replace(/\/+$/, '');

const buildFinalPath = (normalizedPath: string): string => {
  const apiPathPrefix = getApiPathPrefix();

  if (!apiPathPrefix || apiPathPrefix === '/') {
    return normalizedPath || apiPathPrefix || '';
  }

  const cleanedPrefix = stripSlashes(apiPathPrefix);
  if (!normalizedPath) {
    return cleanedPrefix ? `/${cleanedPrefix}` : '';
  }

  const cleanedPath = stripSlashes(normalizedPath);
  if (!cleanedPath) {
    return cleanedPrefix ? `/${cleanedPrefix}` : '';
  }

  const lowerPrefix = cleanedPrefix.toLowerCase();
  const lowerPath = cleanedPath.toLowerCase();

  if (lowerPath === lowerPrefix || lowerPath.startsWith(`${lowerPrefix}/`)) {
    return `/${cleanedPath}`;
  }

  return `/${cleanedPrefix}/${cleanedPath}`;
};

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    assertNoDoubleApi(path);
    return path;
  }

  const { normalizedPath, suffix } = normalizeResourcePath(path || '');
  const origin = getApiOrigin();
  const finalPath = buildFinalPath(normalizedPath);
  const url = `${origin}${finalPath}${suffix}`;
  assertNoDoubleApi(url);
  return url;
}

export const resolveApiUrl = buildApiUrl;

const DEFAULT_WS_PATH = '/ws';

const toWsOrigin = (httpOrigin: string) => {
  if (httpOrigin.startsWith('https://')) return `wss://${httpOrigin.slice('https://'.length)}`;
  if (httpOrigin.startsWith('http://')) return `ws://${httpOrigin.slice('http://'.length)}`;
  return httpOrigin;
};

const resolveWsPath = (path?: string) => {
  const candidate = path && path.trim().length > 0 ? path : DEFAULT_WS_PATH;
  const { normalizedPath, suffix } = normalizeResourcePath(candidate);
  const wsPath = normalizedPath || DEFAULT_WS_PATH;
  return { wsPath, suffix };
};

export function resolveWsUrl(path = DEFAULT_WS_PATH): string {
  const rawWsUrl = getRawWsUrl();
  if (rawWsUrl) {
    return rawWsUrl;
  }

  if (!devMode) {
    return '';
  }

  if (!isBrowser) {
    const nodeWs = readNodeEnv('WS_URL');
    if (nodeWs) {
      return nodeWs;
    }
  }

  if (/^wss?:\/\//i.test(path || '')) {
    return path as string;
  }

  const envBase = getEnvBase();
  const apiOrigin = envBase.origin || getApiOrigin();
  const wsOrigin = toWsOrigin(apiOrigin);
  const { wsPath, suffix } = resolveWsPath(path);
  return `${wsOrigin}${wsPath}${suffix}`;
}
