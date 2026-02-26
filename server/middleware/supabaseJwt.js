import jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';
import LRUCache from 'lru-cache';
import nodeFetch from 'node-fetch';
import { extractTokenFromHeader } from '../utils/jwt.js';

const JWT_AUTH_BYPASS_PATHS = ['/api/health', '/api/auth/login'];
const DEV_FALLBACK_ENABLED = String(process.env.DEV_FALLBACK || '').toLowerCase() === 'true';
const E2E_MODE = String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true';
const DEFAULT_SUPABASE_ISSUER = 'https://eprsgmfzqjptfywoecuy.supabase.co/auth/v1';
const configuredIssuer = (process.env.SUPABASE_JWT_ISSUER || '').trim();
const ENV_SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const derivedIssuer = ENV_SUPABASE_URL ? `${ENV_SUPABASE_URL.replace(/\/+$/, '')}/auth/v1` : '';
const SUPABASE_JWT_ISSUER = (configuredIssuer || derivedIssuer || DEFAULT_SUPABASE_ISSUER).replace(/\/+$/, '');
const hasCustomIssuerConfig = Boolean((process.env.SUPABASE_JWT_ISSUER || '').trim() || derivedIssuer);
const SUPABASE_JWKS_URL = (process.env.SUPABASE_JWKS_URL || `${SUPABASE_JWT_ISSUER}/certs`).replace(/\/+$/, '');
const JWKS_CACHE_TTL_MS = Number(process.env.SUPABASE_JWKS_CACHE_MS || 5 * 60 * 1000);
const SIGNING_KEY_CACHE_TTL_MS = Number(process.env.SUPABASE_JWKS_KEY_CACHE_MS || 60 * 60 * 1000);
const JWKS_CACHE_KEY = 'supabase_jwks';
const AUDIENCE = 'authenticated';

const jwksCache = new LRUCache({ max: 2, ttl: JWKS_CACHE_TTL_MS });
const signingKeyCache = new LRUCache({ max: 10, ttl: SIGNING_KEY_CACHE_TTL_MS });

const shouldBypass = (path = '') => JWT_AUTH_BYPASS_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const fetchWithTimeout = async (url, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const fetcher = typeof fetch === 'function' ? fetch : nodeFetch;
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`jwks_fetch_failed:${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const downloadJwks = async () => {
  const cached = jwksCache.get(JWKS_CACHE_KEY);
  if (cached) return cached;
  const body = await fetchWithTimeout(SUPABASE_JWKS_URL);
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  jwksCache.set(JWKS_CACHE_KEY, keys);
  return keys;
};

const convertJwkToPem = (jwk) => {
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  return publicKey.export({ format: 'pem', type: 'spki' });
};

const resolveSigningKey = async (kid) => {
  if (!kid) {
    throw new Error('missing_kid');
  }
  const cached = signingKeyCache.get(kid);
  if (cached) return cached;
  const keys = await downloadJwks();
  const jwk = keys.find((key) => key.kid === kid);
  if (!jwk) {
    jwksCache.delete(JWKS_CACHE_KEY);
    throw new Error('unknown_kid');
  }
  const pem = convertJwkToPem(jwk);
  signingKeyCache.set(kid, pem);
  return pem;
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
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded !== 'object' || !decoded.header) {
    throw new Error('invalid_token');
  }
  const pem = await resolveSigningKey(decoded.header.kid);
  const payload = jwt.verify(token, pem, {
    algorithms: ['RS256'],
    audience: AUDIENCE,
    issuer: SUPABASE_JWT_ISSUER,
    clockTolerance: 5,
  });
  if (!payload || !payload.sub) {
    throw new Error('invalid_payload');
  }
  return payload;
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
