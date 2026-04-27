const ORG_REQUIRED_PATH_PREFIXES = ['/api/admin', '/api/courses', '/api/modules', '/api/lessons'];
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

import { GLOBAL_ORG_ID } from '../constants/org';

let globalActiveOrgId: string | null = null;

export const ORG_HEADER_NAME = 'X-Organization-Id';
export const LEGACY_ORG_HEADER_NAME = 'X-Org-Id';

export const setGlobalActiveOrgIdForApi = (orgId: string | null | undefined) => {
  globalActiveOrgId = orgId?.trim() || null;
};

export function getGlobalActiveOrgIdForApi(): string | null {
  return globalActiveOrgId;
}

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
  // When the global active org is explicitly set to the special ALL_ORGS
  // sentinel, we intentionally omit sending an org header so the backend
  // will treat the request as platform-scoped (admins). If an org id is
  // available, return it so clients can attach it to requests. If no org
  // context is available, return null and let the backend enforce scoping.
  if (globalActiveOrgId === GLOBAL_ORG_ID) return null;
  if (globalActiveOrgId) return globalActiveOrgId;
  // For admin-prefixed paths we also omit client-side enforcement and allow
  // the backend to determine the effective scope.
  if (normalizedPath.startsWith('/api/admin')) return null;
  return null;
};

export const __setTestOrgContext = (orgId: string | null) => {
  globalActiveOrgId = orgId;
};

// Helper: buildScopedApiUrl
// Usage: buildScopedApiUrl(path, activeOrgId)
// - If orgId is falsy or equals GLOBAL_ORG_ID, returns a path with /api prefix but no orgId query param.
// - Otherwise appends ?orgId=... (or &orgId=... when query params already present).
export const buildScopedApiUrl = (path: string, orgId?: string | null): string => {
  const normalizedPath = path?.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  if (!orgId || orgId === GLOBAL_ORG_ID) {
    return normalizedPath;
  }
  const separator = normalizedPath.includes('?') ? '&' : '?';
  return `${normalizedPath}${separator}orgId=${encodeURIComponent(orgId)}`;
};
