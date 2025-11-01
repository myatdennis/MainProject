const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function api(path: string, init?: RequestInit) {
  if (!BASE) {
    throw new Error('VITE_API_BASE_URL is not configured');
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${BASE}${normalizedPath}`, init);
}
