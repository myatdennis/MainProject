import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './tokenUtils.js';

const ACCESS_TOKEN_COOKIE = process.env.ACCESS_TOKEN_COOKIE_NAME || 'access_token';
const REFRESH_TOKEN_COOKIE = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token';
const ACTIVE_ORG_COOKIE = process.env.ACTIVE_ORG_COOKIE_NAME || 'active_org';

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';

// Shared helper to get request host for cookie logic
function getRequestHost(req) {
  if (!req || typeof req !== 'object') return '';
  let host = req.headers && req.headers.host;
  if (host && typeof host === 'string' && host.length > 0) {
    host = host.split(',')[0].trim().split(':')[0].toLowerCase();
    if (host) return host;
  }
  host = req.headers && req.headers['x-forwarded-host'];
  if (host && typeof host === 'string' && host.length > 0) {
    host = host.split(',')[0].trim().split(':')[0].toLowerCase();
    if (host) return host;
  }
  if (req.hostname && typeof req.hostname === 'string') {
    return req.hostname.trim().toLowerCase();
  }
  return '';
}

// Auth cookies must be host-only in local development. Browsers reject
// `.the-huddle.co` cookies on localhost, which makes login appear to succeed
// while the subsequent session bootstrap is unauthenticated.
function sanitizeOverrides(overrides = {}) {
  // Strip ALL unsafe overrides
  const { httpOnly, secure, sameSite, domain, ...safeOverrides } = overrides || {};
  return safeOverrides;
}

export function getCookieOptions(...args) {
  // Backwards-compatible: callers may pass (req, overrides) or the new
  // signature getCookieOptions(overrides = {}). We detect the shapes and
  // normalize to an overrides object.
  let overrides = {};
  if (args.length === 1) {
    overrides = args[0] || {};
    // If the single arg looks like an Express request (has headers or hostname),
    // treat it as no overrides.
    if (overrides && (overrides.headers || overrides.hostname)) {
      overrides = {};
    }
  } else if (args.length >= 2) {
    overrides = args[1] || {};
  }

  const isProd = isProduction;

  const baseOptions = {
    httpOnly: true, // ALWAYS TRUE
    path: '/',
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? process.env.COOKIE_DOMAIN : undefined,
  };

  const safeOverrides = sanitizeOverrides(overrides);

  const finalOptions = {
    ...baseOptions,
    ...safeOverrides,
  };

  // Temporary debug to verify runtime cookie policy in local dev
  console.log('[COOKIE FINAL]', finalOptions);

  return finalOptions;
}

/**
 * Public cookie options builder — used for non-auth cookies that client JS
 * must read (for example CSRF double-submit tokens). This still enforces
 * security-related attributes (secure, sameSite, domain) based on environment
 * but allows httpOnly to be false so scripts can read the cookie value.
 */
export function getPublicCookieOptions(...args) {
  // Normalize args similar to getCookieOptions
  let overrides = {};
  if (args.length === 1) {
    overrides = args[0] || {};
    if (overrides && (overrides.headers || overrides.hostname)) {
      overrides = {};
    }
  } else if (args.length >= 2) {
    overrides = args[1] || {};
  }

  const isProd = isProduction;
  const baseOptions = {
    httpOnly: false, // intentionally readable by client-side JS
    path: '/',
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? process.env.COOKIE_DOMAIN : undefined,
  };

  const finalOptions = {
    ...baseOptions,
    ...sanitizeOverrides(overrides),
  };

  console.log('[COOKIE FINAL]', finalOptions);
  return finalOptions;
}

export const describeCookiePolicy = () => ({
  production: isProduction,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  domain: isProduction ? process.env.COOKIE_DOMAIN : null,
  path: '/',
});

const applyCookie = (req, res, name, value, maxAgeSeconds, overrides = {}) => {
  const request = req || res.req || null;
  const baseOptions = getCookieOptions(request || undefined, { name });
  const normalizedMaxAgeMs =
    typeof maxAgeSeconds === 'number' && Number.isFinite(maxAgeSeconds) && maxAgeSeconds <= 0
      ? 0
      : Math.max(1000, Math.trunc(maxAgeSeconds * 1000));

  const merged = {
    ...baseOptions,
    ...sanitizeOverrides(overrides),
    maxAge: normalizedMaxAgeMs,
  };
  if (normalizedMaxAgeMs === 0) {
    merged.expires = new Date(0);
  }
  if (merged.sameSite === 'none' && !merged.secure) {
    merged.secure = true;
  }
  res.cookie(name, value, merged);
};

export const setAuthCookies = (req, res, { accessToken, refreshToken }) => {
  if (typeof accessToken === 'string') {
    applyCookie(req, res, ACCESS_TOKEN_COOKIE, accessToken, ACCESS_TOKEN_TTL_SECONDS);
  }
  if (typeof refreshToken === 'string') {
    applyCookie(req, res, REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_TTL_SECONDS);
  }
};

export const attachAuthCookies = (req, res, tokens) => {
  setAuthCookies(req, res, tokens);
};

export const clearAuthCookies = (req, res) => {
  applyCookie(req, res, ACCESS_TOKEN_COOKIE, '', 0);
  applyCookie(req, res, REFRESH_TOKEN_COOKIE, '', 0);
  applyCookie(req, res, ACTIVE_ORG_COOKIE, '', 0);
};


export const getAccessTokenFromRequest = (req) =>
  req?.cookies?.[ACCESS_TOKEN_COOKIE] || req?.cookies?.sb_access_token || null;
export const getRefreshTokenFromRequest = (req) => req?.cookies?.[REFRESH_TOKEN_COOKIE] || null;
export const getActiveOrgFromRequest = (req) => {
  const candidate = req?.cookies?.[ACTIVE_ORG_COOKIE];
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  return trimmed || null;
};

export const setActiveOrgCookie = (req, res, orgId) => {
  const value = orgId ? String(orgId).trim() : '';
  if (!value) {
    applyCookie(req, res, ACTIVE_ORG_COOKIE, '', 0);
    return;
  }
  applyCookie(req, res, ACTIVE_ORG_COOKIE, value, REFRESH_TOKEN_TTL_SECONDS);
};

export const authCookieNames = {
  access: ACCESS_TOKEN_COOKIE,
  refresh: REFRESH_TOKEN_COOKIE,
  activeOrg: ACTIVE_ORG_COOKIE,
};
