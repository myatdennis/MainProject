export function isPlatformAdmin(user: any): boolean {
  return user?.app_metadata?.platform_role === 'platform_admin';
}