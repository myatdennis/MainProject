import { resolveActiveOrgId } from './orgHeaders';

const hasQueryOrgId = (params: URLSearchParams): boolean =>
  ['orgId', 'organizationId', 'org_id', 'organization_id'].some((key) => {
    const value = params.get(key);
    return typeof value === 'string' && value.trim().length > 0;
  });

export const resolveExplicitAdminOrgId = (preferredOrgId?: string | null): string | null => {
  const explicit = typeof preferredOrgId === 'string' ? preferredOrgId.trim() : '';
  if (explicit) {
    return explicit;
  }
  return resolveActiveOrgId();
};

export const requireExplicitAdminOrgId = (surface: string, preferredOrgId?: string | null): string => {
  const orgId = resolveExplicitAdminOrgId(preferredOrgId);
  if (orgId) {
    return orgId;
  }

  const error = new Error(`Organization context is required for ${surface}.`);
  (error as Error & { code?: string }).code = 'org_id_required';
  throw error;
};

export const appendAdminOrgIdQuery = (path: string, preferredOrgId?: string | null): string => {
  const orgId = resolveExplicitAdminOrgId(preferredOrgId);
  if (!orgId) {
    return path;
  }

  const [pathname, hash = ''] = path.split('#', 2);
  const [basePath, search = ''] = pathname.split('?', 2);
  const params = new URLSearchParams(search);
  if (!hasQueryOrgId(params)) {
    params.set('orgId', orgId);
  }

  const nextQuery = params.toString();
  const nextPath = nextQuery ? `${basePath}?${nextQuery}` : basePath;
  return hash ? `${nextPath}#${hash}` : nextPath;
};
