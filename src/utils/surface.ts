const getPathname = (override?: string): string => {
  if (typeof override === 'string') {
    return override;
  }
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return '';
  }
  return window.location.pathname || '';
};

export const isAdminSurface = (pathnameOverride?: string): boolean => {
  try {
    const pathname = getPathname(pathnameOverride).toLowerCase();
    return pathname.startsWith('/admin');
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
