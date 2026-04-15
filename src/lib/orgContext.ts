const ORG_REQUIRED_PATH_PREFIXES = ['/api/admin', '/api/courses', '/api/modules', '/api/lessons'];
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

let globalActiveOrgId: string | null = null;

export const ORG_HEADER_NAME = 'X-Organization-Id';
export const LEGACY_ORG_HEADER_NAME = 'X-Org-Id';

export const setGlobalActiveOrgIdForApi = (orgId: string | null | undefined) => {
  globalActiveOrgId = orgId?.trim() || null;
};

export const getGlobalActiveOrgIdForApi = (): string | null => globalActiveOrgId;

const normalizePathForOrgCheck = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (ABSOLUTE_URL_PATTERN.test(trimmed)) {
    try {
      return new URL(trimmed).pathname || '/';
    } catch {
      return '/';
    }
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/${trimmed}`;
};

export const pathRequiresOrgHeader = (inputPath: string): boolean => {
  const normalizedPath = normalizePathForOrgCheck(inputPath);
  if (!normalizedPath) return false;
  return ORG_REQUIRED_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
};

export const resolveOrgHeaderForRequest = (inputPath: string): string | null => {
  const normalizedPath = normalizePathForOrgCheck(inputPath);
  if (!pathRequiresOrgHeader(inputPath)) {
    return null;
  }
  if (globalActiveOrgId) {
    return globalActiveOrgId;
  }
  if (normalizedPath.startsWith('/api/admin')) {
    // Admin routes are permitted to execute without an explicit org header
    // because platform admins and server-side org resolution can still
    // determine the correct scope. Do not block the request in this case.
    console.warn('[client] admin_request_without_org_header', { path: inputPath });
    return null;
  }
  console.warn('[client] missing_org_context', { path: inputPath });
  throw new Error('[client] missing_org_context');
};

export const __setTestOrgContext = (orgId: string | null) => {
  globalActiveOrgId = orgId;
};
