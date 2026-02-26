import { LRUCache } from 'lru-cache';
import { createLocalJWKSet, jwtVerify } from 'jose';
import nodeFetch from 'node-fetch';
import { extractTokenFromHeader } from '../utils/jwt.js';

const JWT_AUTH_BYPASS_PATHS = ['/api/health', '/api/auth/login', '/api/auth/refresh'];
const DEV_FALLBACK_ENABLED = String(process.env.DEV_FALLBACK || '').toLowerCase() === 'true';
const E2E_MODE = String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true';
const DEFAULT_SUPABASE_ISSUER = 'https://eprsgmfzqjptfywoecuy.supabase.co/auth/v1';
const configuredIssuer = (process.env.SUPABASE_JWT_ISSUER || '').trim();
const ENV_SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const derivedIssuer = ENV_SUPABASE_URL ? `${ENV_SUPABASE_URL.replace(/\/+$/, '')}/auth/v1` : '';
const SUPABASE_JWT_ISSUER = (configuredIssuer || derivedIssuer || DEFAULT_SUPABASE_ISSUER).replace(/\/+$/, '');
const hasCustomIssuerConfig = Boolean((process.env.SUPABASE_JWT_ISSUER || '').trim() || derivedIssuer);
const resolvedSupabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_JWKS_URL = resolvedSupabaseUrl
  ? `${resolvedSupabaseUrl}/auth/v1/certs`
  : (process.env.SUPABASE_JWT_ISSUER || DEFAULT_SUPABASE_ISSUER).replace(/\/+$/, '') + '/certs';
const JWKS_CACHE_TTL_MS = Number(process.env.SUPABASE_JWKS_CACHE_MS || 5 * 60 * 1000);
const JWKS_CACHE_KEY = 'supabase_jwks';
const AUDIENCE = 'authenticated';

const jwksCache = new LRUCache({
  max: 2,
  ttl: JWKS_CACHE_TTL_MS,
});

const shouldBypass = (path = '') => JWT_AUTH_BYPASS_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const fetchWithTimeout = async (url, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const fetcher = typeof fetch === 'function' ? fetch : nodeFetch;
  const headers = {
    Accept: 'application/json',
    ...(process.env.SUPABASE_ANON_KEY ? { apikey: process.env.SUPABASE_ANON_KEY } : {}),
  };
  try {
    const response = await fetcher(url, { signal: controller.signal, headers });
    if (!response.ok) {
      console.error('[supabaseJwt] jwks_fetch_failed', { status: response.status });
      throw new Error(`jwks_fetch_failed:${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const buildLocalJwksClient = async () => {
  const cached = jwksCache.get(JWKS_CACHE_KEY);
  if (cached) {
    return cached;
  }
  const body = await fetchWithTimeout(SUPABASE_JWKS_URL);
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  if (keys.length === 0) {
    throw new Error('jwks_empty');
  }
  const client = createLocalJWKSet({ keys });
  jwksCache.set(JWKS_CACHE_KEY, client);
  return client;
};

const resolveTokenFromRequest = (req) => {
  const headerToken = extractTokenFromHeader(req.headers?.authorization);
  if (headerToken) return headerToken;
  return null;
};

const mapClaimsToUser = (claims) => ({
  id: claims.sub,
  email: claims.email || claims.user_email || null,
  app_metadata: claims.app_metadata || {},
  user_metadata: claims.user_metadata || {},
  role: claims.role || claims?.app_metadata?.role || null,
});

const verifySupabaseToken = async (token) => {
  const jwksClient = await buildLocalJwksClient();
  try {
    const { payload } = await jwtVerify(token, jwksClient, {
      algorithms: ['RS256'],
      audience: AUDIENCE,
      issuer: SUPABASE_JWT_ISSUER,
      clockTolerance: 5,
    });
    if (!payload || !payload.sub) {
      throw new Error('invalid_payload');
    }
    return payload;
  } catch (error) {
    if (error?.code && String(error.code).startsWith('ERR_JWKS')) {
      jwksCache.delete(JWKS_CACHE_KEY);
    }
    throw error;
  }
};

const shouldSkipAuthInDev = (DEV_FALLBACK_ENABLED || E2E_MODE) && !hasCustomIssuerConfig;

export default async function supabaseJwtMiddleware(req, res, next) {
  if (shouldBypass(req.path || req.originalUrl || '')) {
    return next();
  }

  if (shouldSkipAuthInDev) {
    return next();
  }

  const token = resolveTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No bearer token provided in the Authorization header',
    });
  }

  try {
    const claims = await verifySupabaseToken(token);
    req.supabaseJwtClaims = claims;
    req.supabaseJwtUser = mapClaimsToUser(claims);
    req.supabaseJwtToken = token;
    return next();
  } catch (error) {
    const code = error?.message || 'token_verification_failed';
    console.warn('[supabaseJwt] token validation failed', code);
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Invalid or expired token',
    });
  }
}
