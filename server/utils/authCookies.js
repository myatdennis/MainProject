import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './jwt.js';

const ACCESS_TOKEN_COOKIE = process.env.ACCESS_TOKEN_COOKIE_NAME || 'access_token';
const REFRESH_TOKEN_COOKIE = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token';

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
const secureByDefault = parseBoolean(process.env.COOKIE_SECURE, isProduction);
const rawSameSite = (process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
const sameSite = ['lax', 'strict', 'none'].includes(rawSameSite)
  ? rawSameSite
  : secureByDefault
    ? 'none'
    : 'lax';


// Shared helper to get request host for cookie logic
function getRequestHost(req) {
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

// Per-request cookie domain logic
function resolveCookieDomain(req) {
  if (process.env.NODE_ENV !== 'production') return undefined;
  const host = getRequestHost(req);
  const isHuddleDomain = host === 'the-huddle.co' || host.endsWith('.the-huddle.co');
  if (isHuddleDomain) {
    return process.env.COOKIE_DOMAIN || '.the-huddle.co';
  }
  return undefined;
}
function resolveCookieSameSite() {
  return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
}
function resolveCookieSecure() {
  return process.env.NODE_ENV === 'production';
}
function getCookieOptions(req, { httpOnly = true, name } = {}) {
  const domain = resolveCookieDomain(req);
  const opts = {
    httpOnly,
    secure: resolveCookieSecure(),
    sameSite: resolveCookieSameSite(),
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
  res.cookie(name, value, options);
};

export const attachAuthCookies = (req, res, tokens) => {
  setCookie(res, ACCESS_TOKEN_COOKIE, tokens.accessToken, resolveMaxAge(ACCESS_TOKEN_TTL_SECONDS * 1000, tokens.expiresAt), req, { name: ACCESS_TOKEN_COOKIE });
  setCookie(
    res,
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    resolveMaxAge(REFRESH_TOKEN_TTL_SECONDS * 1000, tokens.refreshExpiresAt),
    req,
    { name: REFRESH_TOKEN_COOKIE }
  );
};

const clearCookie = (res, name, req, opts = {}) => {
  const options = { ...getCookieOptions(req, { ...opts, name }), maxAge: 0 };
  res.cookie(name, '', options);
};

export const clearAuthCookies = (req, res) => {
  clearCookie(res, ACCESS_TOKEN_COOKIE, req, { name: ACCESS_TOKEN_COOKIE });
  clearCookie(res, REFRESH_TOKEN_COOKIE, req, { name: REFRESH_TOKEN_COOKIE });
};


export const getAccessTokenFromRequest = (req) => req?.cookies?.[ACCESS_TOKEN_COOKIE] || null;
export const getRefreshTokenFromRequest = (req) => req?.cookies?.[REFRESH_TOKEN_COOKIE] || null;

export const authCookieNames = {
  access: ACCESS_TOKEN_COOKIE,
  refresh: REFRESH_TOKEN_COOKIE,
};
