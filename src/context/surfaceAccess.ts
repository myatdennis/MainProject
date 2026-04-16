import type { UserSession } from '../lib/secureStorage';

export type SessionSurface = 'admin' | 'lms' | 'client';
export type RefreshReason = 'protected_401' | 'user_retry';
export type SurfaceAuthStatus = 'idle' | 'checking' | 'ready' | 'error';

export interface AuthState {
  lms: boolean;
  admin: boolean;
  client: boolean;
}

export const computeAuthState = (user: UserSession | null, surface?: SessionSurface): AuthState => {
  if (!user) {
    return { lms: false, admin: false, client: false };
  }

  const role = String(user.role || '').toLowerCase();
  const isRoleAdmin = role === 'admin' || Boolean(user.isPlatformAdmin);

  if (surface === 'admin') {
    return { admin: isRoleAdmin, lms: false, client: false };
  }
  if (surface === 'lms') {
    return { admin: false, lms: true, client: true };
  }
  if (surface === 'client') {
    return { admin: false, lms: true, client: true };
  }
  return { admin: isRoleAdmin, lms: !isRoleAdmin, client: !isRoleAdmin };
};
