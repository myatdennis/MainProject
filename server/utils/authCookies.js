import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './tokenUtils.js';

const ACCESS_TOKEN_COOKIE = process.env.ACCESS_TOKEN_COOKIE_NAME || 'access_token';
const REFRESH_TOKEN_COOKIE = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token';
const ACTIVE_ORG_COOKIE = process.env.ACTIVE_ORG_COOKIE_NAME || 'active_org';

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const productionCookieDomain = (process.env.COOKIE_DOMAIN || '').trim() || '.the-huddle.co';

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
function resolveCookieDomain(_req) {
  return isProduction ? productionCookieDomain : undefined;
}
function resolveCookieSameSite(_req) {
  return isProduction ? 'none' : 'lax';
}
function resolveCookieSecure(_req) {
  return isProduction;
}
export function getCookieOptions(req, { httpOnly = true, name } = {}) {
  const domain = resolveCookieDomain(req);
  const opts = {
    httpOnly,
    secure: resolveCookieSecure(req),
    sameSite: resolveCookieSameSite(req),
    path: '/',
  };
  if (domain) opts.domain = domain;
  if (process.env.DEBUG_COOKIES === 'true') {
    console.log('[COOKIE]', {
      req_host: req.headers && req.headers.host,
      x_forwarded_host: req.headers && req.headers['x-forwarded-host'],
      req_hostname: req.hostname,
      computed_host: getRequestHost(req),
      computed_domain: opts.domain,
      sameSite: opts.sameSite,
      secure: opts.secure,
      name: name || undefined,
    });
  }
  return opts;
}

export const describeCookiePolicy = () => ({
  production: isProduction,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  domain: isProduction ? productionCookieDomain : null,
  path: '/',
});

const applyCookie = (req, res, name, value, maxAgeSeconds, overrides = {}) => {
  const request = req || res.req || null;
  const baseOptions = getCookieOptions(request || undefined, { httpOnly: overrides.httpOnly ?? true, name });
  const normalizedMaxAgeMs =
    typeof maxAgeSeconds === 'number' && Number.isFinite(maxAgeSeconds) && maxAgeSeconds <= 0
      ? 0
      : Math.max(1000, Math.trunc(maxAgeSeconds * 1000));
  const merged = {
    ...baseOptions,
    ...overrides,
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


export const getAccessTokenFromRequest = (req) => req?.cookies?.[ACCESS_TOKEN_COOKIE] || null;
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
