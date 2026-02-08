import type { Request, Response } from 'express';

const ACCESS_TOKEN_COOKIE = process.env.ACCESS_TOKEN_COOKIE_NAME || 'access_token';
const REFRESH_TOKEN_COOKIE = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token';
const DEFAULT_COOKIE_DOMAIN = process.env.COOKIE_FALLBACK_DOMAIN || '.the-huddle.co';

const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.JWT_ACCESS_TTL ?? 15 * 60);
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.JWT_REFRESH_TTL ?? 7 * 24 * 60 * 60);

const parseBoolean = (value: string | boolean | undefined | null, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const secureByDefault = isProduction ? true : parseBoolean(process.env.COOKIE_SECURE, false);
const allowedSameSite = new Set(['lax', 'strict', 'none']);
const rawSameSite = (process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
const sameSite =
  isProduction || secureByDefault
    ? 'none'
    : allowedSameSite.has(rawSameSite)
      ? rawSameSite
      : 'lax';

const normalizeDomain = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('.') ? trimmed : `.${trimmed.replace(/^\.+/, '')}`;
};

const envCookieDomain = normalizeDomain(process.env.COOKIE_DOMAIN);
const fallbackCookieDomain = normalizeDomain(DEFAULT_COOKIE_DOMAIN);

const hostMatchesDomain = (host: string, domain: string) => {
  if (!host || !domain) return false;
  const normalizedHost = host.toLowerCase();
  const normalizedDomain = domain.replace(/^\./, '');
  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  );
};

type CookieAwareRequest = Request & { cookies?: Record<string, string | undefined> };

const getRequestHost = (req: Request): string => {
  let host = req.headers?.host;
  if (host && typeof host === 'string') {
    host = host.split(',')[0]?.trim().split(':')[0]?.toLowerCase() ?? '';
    if (host) return host;
  }
  const forwarded = req.headers?.['x-forwarded-host'];
  if (forwarded && typeof forwarded === 'string') {
    const parsed = forwarded.split(',')[0]?.trim().split(':')[0]?.toLowerCase() ?? '';
    if (parsed) return parsed;
  }
  if (typeof req.hostname === 'string') {
    return req.hostname.trim().toLowerCase();
  }
  return '';
};

const resolveCookieDomain = (req: Request): string | undefined => {
  if (!isProduction) return undefined;
  if (envCookieDomain) return envCookieDomain;
  const host = getRequestHost(req);
  if (host && fallbackCookieDomain && hostMatchesDomain(host, fallbackCookieDomain)) {
    return fallbackCookieDomain;
  }
  return undefined;
};

const resolveCookieSameSite = () => sameSite as 'lax' | 'strict' | 'none';
const resolveCookieSecure = () => secureByDefault || isProduction;

type CookieOptionsInput = {
  name?: string;
  httpOnly?: boolean;
};

export const getCookieOptions = (req: Request, opts: CookieOptionsInput = {}) => {
  const domain = resolveCookieDomain(req);
  const options: Parameters<Response['cookie']>[2] = {
    httpOnly: opts.httpOnly ?? true,
    secure: resolveCookieSecure(),
    sameSite: resolveCookieSameSite(),
    path: '/',
  };
  if (domain) {
    options.domain = domain;
  }
  if (process.env.DEBUG_COOKIES === 'true') {
    console.log('[COOKIE]', {
      req_host: req.headers?.host,
      x_forwarded_host: req.headers?.['x-forwarded-host'],
      req_hostname: req.hostname,
      computed_host: getRequestHost(req),
      computed_domain: options.domain,
      sameSite: options.sameSite,
      secure: options.secure,
      name: opts.name,
    });
  }
  return options;
};

export const describeCookiePolicy = () => ({
  production: isProduction,
  secure: resolveCookieSecure(),
  sameSite: resolveCookieSameSite(),
  domain: envCookieDomain || (isProduction ? fallbackCookieDomain || undefined : undefined),
  path: '/',
});

const resolveMaxAge = (fallbackMs: number, expiresAt?: number | null) => {
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    const delta = expiresAt - Date.now();
    if (delta > 0) {
      return delta;
    }
  }
  return fallbackMs;
};

const setCookie = (
  req: Request,
  res: Response,
  name: string,
  value: string,
  maxAgeMs: number,
  opts: CookieOptionsInput = {},
) => {
  const options = { ...getCookieOptions(req, { ...opts, name }), maxAge: Math.max(1000, maxAgeMs) };
  if (options.sameSite === 'none' && !options.secure) {
    options.secure = true;
  }
  res.cookie(name, value, options);
};

type CookieTokenPayload = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt?: number | null;
};

export const attachAuthCookies = (req: Request, res: Response, tokens: CookieTokenPayload) => {
  setCookie(
    req,
    res,
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    resolveMaxAge(ACCESS_TOKEN_TTL_SECONDS * 1000, tokens.expiresAt),
    { name: ACCESS_TOKEN_COOKIE },
  );
  setCookie(
    req,
    res,
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    resolveMaxAge(REFRESH_TOKEN_TTL_SECONDS * 1000, tokens.refreshExpiresAt ?? null),
    { name: REFRESH_TOKEN_COOKIE },
  );
};

const clearCookie = (req: Request, res: Response, name: string) => {
  const options = { ...getCookieOptions(req, { name }), maxAge: 0 };
  res.cookie(name, '', options);
};

export const clearAuthCookies = (req: Request, res: Response) => {
  clearCookie(req, res, ACCESS_TOKEN_COOKIE);
  clearCookie(req, res, REFRESH_TOKEN_COOKIE);
};

const readCookieBag = (req: Request): Record<string, string | undefined> =>
  (req as CookieAwareRequest)?.cookies ?? {};

export const getAccessTokenFromRequest = (req: Request): string | null =>
  readCookieBag(req)[ACCESS_TOKEN_COOKIE] || null;
export const getRefreshTokenFromRequest = (req: Request): string | null =>
  readCookieBag(req)[REFRESH_TOKEN_COOKIE] || null;

export const authCookieNames = {
  access: ACCESS_TOKEN_COOKIE,
  refresh: REFRESH_TOKEN_COOKIE,
} as const;
