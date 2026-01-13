import { getAccessToken, getUserSession, type UserSession } from './secureStorage';

const PRIVILEGED_ENDPOINT_PATTERNS: RegExp[] = [
  /^\/?api\/admin\b/i,
  /^\/?api\/client\b/i,
  /^\/?api\/learner\b/i,
  /^\/?api\/analytics\b/i,
  /^\/?api\/orgs\b/i,
  /^\/?api\/notifications\b/i,
  /^\/?api\/audit-log\b/i,
  /^\/?api\/onboarding\b/i,
  /^\/?api\/batch\b/i,
];

const PUBLIC_ENDPOINT_ALLOWLIST: RegExp[] = [
  /^\/?api\/health\b/i,
  /^\/?api\/status\b/i,
  /^\/?api\/auth\b/i,
  /^\/?api\/mfa\b/i,
  /^\/?api\/csrf-token\b/i,
  /^\/?api\/csrf\b/i,
  /^\/?api\/invite\b/i,
  /^\/?api\/public\b/i,
];

const stripQueryAndHash = (value: string) => value.split(/[?#]/)[0] ?? value;
const ensureLeadingSlash = (value: string) => (value.startsWith('/') ? value : `/${value}`);
const trimTrailingSlash = (value: string) => (value !== '/' ? value.replace(/\/+$|\/$/g, '') || '/' : value);

const getFallbackOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost';
};

const normalizeTarget = (target: string): string => {
  if (!target) return '';
  const trimmed = target.trim();
  try {
    const base = /^https?:\/\//i.test(trimmed) ? undefined : getFallbackOrigin();
    const url = new URL(trimmed, base);
    return trimTrailingSlash(url.pathname || '/');
  } catch {
    const sanitized = trimTrailingSlash(ensureLeadingSlash(stripQueryAndHash(trimmed)));
    return sanitized || '/';
  }
};

export const hasAuthSession = (): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    const token = getAccessToken();
    const session = getUserSession();
    return Boolean(token || session?.id);
  } catch (error) {
    console.warn('[sessionGate] Failed to read secure session context:', error);
    return false;
  }
};

export const getActiveSession = (): UserSession | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return getUserSession();
  } catch (error) {
    console.warn('[sessionGate] Unable to resolve active session:', error);
    return null;
  }
};

export const isPublicEndpoint = (target: string): boolean => {
  const normalized = normalizeTarget(target);
  if (!normalized) return false;
  return PUBLIC_ENDPOINT_ALLOWLIST.some((regex) => regex.test(normalized));
};

export const isPrivilegedEndpoint = (target: string): boolean => {
  const normalized = normalizeTarget(target);
  if (!normalized) return false;
  return PRIVILEGED_ENDPOINT_PATTERNS.some((regex) => regex.test(normalized));
};

export interface RequestGuardOptions {
  reason?: string;
  requireAuth?: boolean;
  allowAnonymous?: boolean;
}

export const shouldRequireSession = (target: string, options?: RequestGuardOptions): boolean => {
  if (options?.allowAnonymous) {
    return false;
  }
  if (options?.requireAuth) {
    return true;
  }
  const normalized = normalizeTarget(target);
  if (!normalized) return false;
  if (isPublicEndpoint(normalized)) {
    return false;
  }
  return isPrivilegedEndpoint(normalized);
};

export class SessionGateError extends Error {
  code: string;
  path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = 'SessionGateError';
    this.code = 'SESSION_REQUIRED';
    this.path = path;
  }
}

export const guardRequest = (target: string, options?: RequestGuardOptions): void => {
  const normalized = normalizeTarget(target);
  if (!shouldRequireSession(normalized, options)) {
    return;
  }
  if (hasAuthSession()) {
    return;
  }

  const reason = options?.reason ? options.reason : `Blocked privileged request without session (${normalized})`;
  throw new SessionGateError(`[sessionGate] ${reason}`, normalized);
};
