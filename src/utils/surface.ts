const getPathname = (override?: string): string => {
  if (typeof override === 'string') {
    try {
      const url = new URL(override, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      return url.pathname;
    } catch {
      const queryIndex = override.indexOf('?');
      return queryIndex >= 0 ? override.slice(0, queryIndex) : override;
    }
  }
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return '';
  }
  return window.location.pathname || '';
};

const getSearchParams = (override?: string): URLSearchParams => {
  if (typeof override === 'string') {
    try {
      const url = new URL(override, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      return new URLSearchParams(url.search);
    } catch {
      const queryIndex = override.indexOf('?');
      return new URLSearchParams(queryIndex >= 0 ? override.slice(queryIndex) : '');
    }
  }
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return new URLSearchParams('');
  }
  return new URLSearchParams(window.location.search);
};

const hasAdminFragment = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized.startsWith('/admin') || normalized.includes('/admin/') || normalized.startsWith('#/admin');
};

const isTruthyAdminParam = (value: string | null): boolean => {
  if (value === null) return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === '') return true;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const hasAdminQueryParam = (searchParams: URLSearchParams): boolean => {
  if (isTruthyAdminParam(searchParams.get('admin'))) {
    return true;
  }
  if (searchParams.get('surface')?.toLowerCase() === 'admin') {
    return true;
  }
  if (searchParams.get('role')?.toLowerCase() === 'admin') {
    return true;
  }
  return false;
};

const getHash = (override?: string): string => {
  if (typeof override === 'string') {
    try {
      const url = new URL(override, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      return url.hash || '';
    } catch {
      const hashIndex = override.indexOf('#');
      return hashIndex >= 0 ? override.slice(hashIndex) : '';
    }
  }
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return '';
  }
  return window.location.hash || '';
};

export const isAdminSurface = (pathnameOverride?: string): boolean => {
  try {
    const pathname = getPathname(pathnameOverride).toLowerCase();
    const hash = getHash(pathnameOverride).toLowerCase();
    if (hasAdminFragment(pathname) || hasAdminFragment(hash)) {
      return true;
    }
    const searchParams = getSearchParams(pathnameOverride);
    if (hasAdminQueryParam(searchParams)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const isClientSurface = (pathnameOverride?: string): boolean => !isAdminSurface(pathnameOverride);

export const currentSurface = (): 'admin' | 'client' => (isAdminSurface() ? 'admin' : 'client');

export const assertAdminSurface = (label = 'admin_api'): void => {
  if (isAdminSurface()) return;
  const message = `[${label}] attempted outside admin surface`;
  if (import.meta.env?.DEV) {
    throw new Error(message);
  }
  console.warn(message);
};

export const resolveLoginPath = (pathnameOverride?: string): '/admin/login' | '/login' => {
  return isAdminSurface(pathnameOverride) ? '/admin/login' : '/login';
};

export const isClientLoginPath = (pathnameOverride?: string): boolean => {
  const pathname = getPathname(pathnameOverride);
  return pathname.startsWith('/login') || pathname.startsWith('/lms/login');
};

export const isLoginPath = (pathnameOverride?: string): boolean => {
  const pathname = getPathname(pathnameOverride);
  return pathname.startsWith('/admin/login') || isClientLoginPath(pathnameOverride);
};
