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

const baseCookieOptions = {
  httpOnly: true,
  secure: secureByDefault,
  sameSite,
  domain: process.env.COOKIE_DOMAIN || undefined,
  path: '/',
};

const resolveMaxAge = (fallbackMs, expiresAt) => {
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    const delta = expiresAt - Date.now();
    if (delta > 0) {
      return delta;
    }
  }
  return fallbackMs;
};

const setCookie = (res, name, value, maxAgeMs) => {
  res.cookie(name, value, {
    ...baseCookieOptions,
    maxAge: Math.max(1000, maxAgeMs),
  });
};

export const attachAuthCookies = (res, tokens) => {
  setCookie(res, ACCESS_TOKEN_COOKIE, tokens.accessToken, resolveMaxAge(ACCESS_TOKEN_TTL_SECONDS * 1000, tokens.expiresAt));
  setCookie(
    res,
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    resolveMaxAge(REFRESH_TOKEN_TTL_SECONDS * 1000, tokens.refreshExpiresAt)
  );
};

const clearCookie = (res, name) => {
  res.cookie(name, '', {
    ...baseCookieOptions,
    maxAge: 0,
  });
};

export const clearAuthCookies = (res) => {
  clearCookie(res, ACCESS_TOKEN_COOKIE);
  clearCookie(res, REFRESH_TOKEN_COOKIE);
};

export const getAccessTokenFromRequest = (req) => req?.cookies?.[ACCESS_TOKEN_COOKIE] || null;
export const getRefreshTokenFromRequest = (req) => req?.cookies?.[REFRESH_TOKEN_COOKIE] || null;

export const authCookieNames = {
  access: ACCESS_TOKEN_COOKIE,
  refresh: REFRESH_TOKEN_COOKIE,
};
