const normalizeBase = (value: string | undefined | null) => {
  if (!value) return '';
  return value.trim().replace(/\/$/, '');
};

const RAW_API_BASE = normalizeBase(import.meta.env?.VITE_API_BASE_URL as string | undefined);
const RAW_WS_OVERRIDE = normalizeBase(import.meta.env?.VITE_WS_URL as string | undefined);

const ensureLeadingSlash = (path: string) => (path.startsWith('/') ? path : `/${path}`);

export const API_BASE_URL = RAW_API_BASE;

export const getApiBaseUrl = () => API_BASE_URL;

export const resolveApiUrl = (path: string) => {
  if (!path) return API_BASE_URL || '';
  if (/^https?:\/\//i.test(path) || path.startsWith('//')) {
    return path;
  }

  const normalizedPath = ensureLeadingSlash(path);
  if (!API_BASE_URL) {
    return normalizedPath;
  }
  return `${API_BASE_URL}${normalizedPath}`;
};

export const resolveWsUrl = (path = '/ws') => {
  const normalizedPath = ensureLeadingSlash(path);
  if (RAW_WS_OVERRIDE) {
    if (/^wss?:\/\//i.test(RAW_WS_OVERRIDE)) {
      return RAW_WS_OVERRIDE;
    }
    if (/^https?:\/\//i.test(RAW_WS_OVERRIDE)) {
      return RAW_WS_OVERRIDE.replace(/^http/i, 'ws');
    }
    if (RAW_WS_OVERRIDE.startsWith('/')) {
      return RAW_WS_OVERRIDE;
    }
    return `wss://${RAW_WS_OVERRIDE.replace(/^\/+/, '')}`;
  }

  const base = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) return '';

  try {
    const url = new URL(base);
    url.pathname = normalizedPath;
    url.search = '';
    url.hash = '';

    if (url.protocol === 'https:') {
      url.protocol = 'wss:';
    } else if (url.protocol === 'http:') {
      url.protocol = 'ws:';
    }

    return url.toString();
  } catch {
    return '';
  }
};

export const getApiRoot = () => resolveApiUrl('/api');
