import { getAuthState } from '../store/authStore';

export function isPlatformAdmin(user?: any): boolean {
  if (user) {
    return (
      user?.app_metadata?.platform_role === 'platform_admin' ||
      user?.appMetadata?.platform_role === 'platform_admin' ||
      String(user?.platformRole || user?.platform_role || '').toLowerCase() === 'platform_admin'
    );
  }
  try {
    const auth = getAuthState();
    return Boolean(auth?.isAdmin);
  } catch (e) {
    return false;
  }
}