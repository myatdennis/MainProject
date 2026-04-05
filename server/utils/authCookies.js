import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './tokenUtils.js';

const ACCESS_TOKEN_COOKIE = process.env.ACCESS_TOKEN_COOKIE_NAME || 'access_token';
const REFRESH_TOKEN_COOKIE = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token';
const ACTIVE_ORG_COOKIE = process.env.ACTIVE_ORG_COOKIE_NAME || 'active_org';

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return fallback;
};

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const configuredSameSite = (process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
const sameSite = ['lax', 'strict', 'none'].includes(configuredSameSite) ? configuredSameSite : '';
const rawCookieSecure = process.env.COOKIE_SECURE;
const secureByDefault =
  rawCookieSecure === undefined || String(rawCookieSecure).trim() === ''
    ? null
    : parseBoolean(rawCookieSecure, isProduction);
const configuredCookieDomain = (process.env.COOKIE_DOMAIN || '').trim();
const primaryCookieDomain = configuredCookieDomain || '.the-huddle.co';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

const hostMatchesDomain = (host, domain) => {
  if (!host || !domain) return false;
  const normalizedHost = host.toLowerCase();
  const normalizedDomain = domain.replace(/^\./, '');
  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  );
};

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

const isLocalHost = (host = '') => {
  if (!host) return false;
  const normalized = host.trim().toLowerCase();
  if (!normalized) return false;
  if (LOCAL_HOSTS.has(normalized)) return true;
  if (normalized.endsWith('.local')) return true;
  return false;
};

// Per-request cookie domain logic
function resolveCookieDomain(req) {
  const host = getRequestHost(req);
  if (!host) return undefined;
  return hostMatchesDomain(host, primaryCookieDomain) ? primaryCookieDomain : undefined;
}
function resolveCookieSameSite(req) {
  if (sameSite) return sameSite;
  const host = getRequestHost(req);
  if (host && !isLocalHost(host)) {
    return 'none';
  }
  return 'lax';
}
function resolveCookieSecure(req) {
  if (typeof secureByDefault === 'boolean') {
    return secureByDefault;
  }
  const host = getRequestHost(req);
  if (host && !isLocalHost(host)) {
    return true;
  }
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
  secure: typeof secureByDefault === 'boolean' ? secureByDefault : isProduction,
  sameSite: sameSite || (isProduction ? 'none' : 'lax'),
  domain: primaryCookieDomain || null,
  path: '/',
});

const resolveMaxAge = (fallbackMs, expiresAt) => {
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    const delta = expiresAt - Date.now();
    if (delta > 0) {
      return delta;
    }
  }
  return fallbackMs;
};

const setCookie = (res, name, value, maxAgeMs, req, opts = {}) => {
  const options = { ...getCookieOptions(req, { ...opts, name }), maxAge: Math.max(1000, maxAgeMs) };
  if (options.sameSite === 'none' && !options.secure) {
    options.secure = true;
  }
  res.cookie(name, value, options);
};

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
