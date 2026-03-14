const getPathname = (override?: string): string => {
  if (typeof override === 'string') {
    return override;
  }
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return '';
  }
  return window.location.pathname || '';
};

const hasAdminFragment = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized.startsWith('/admin') || normalized.includes('/admin/') || normalized.startsWith('#/admin');
};

export const isAdminSurface = (pathnameOverride?: string): boolean => {
  try {
    const pathname = getPathname(pathnameOverride).toLowerCase();
    if (hasAdminFragment(pathname)) {
      return true;
    }
    if (typeof window !== 'undefined') {
      const hashPath = window.location.hash ?? '';
      if (hasAdminFragment(hashPath)) {
        return true;
      }
      const search = window.location.search?.toLowerCase() ?? '';
      if (search.includes('admin=') || search.includes('surface=admin')) {
        return true;
      }
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
  if (!pathname) return false;
  if (pathname.startsWith('/admin/login')) {
    return true;
  }
  return isClientLoginPath(pathnameOverride);
};
