import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { LRUCache } from 'lru-cache';
import { extractTokenFromHeader } from '../utils/jwt.js';

const JWT_AUTH_BYPASS_PATHS = ['/api/health', '/api/auth/login', '/api/auth/refresh'];
const DEV_FALLBACK_ENABLED = String(process.env.DEV_FALLBACK || '').toLowerCase() === 'true';
const E2E_MODE = String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true';
const rawSupabaseBaseUrl = (process.env.SUPABASE_URL || '').trim();
if (!rawSupabaseBaseUrl) {
  throw new Error('[supabaseJwt] SUPABASE_URL environment variable is required for JWT validation.');
}

const buildSupabaseUrl = (path) => {
  try {
    return new URL(path, rawSupabaseBaseUrl);
  } catch (error) {
    throw new Error(
      `[supabaseJwt] Invalid SUPABASE_URL "${rawSupabaseBaseUrl}". ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const SUPABASE_JWKS_URL = new URL('/auth/v1/.well-known/jwks.json', rawSupabaseBaseUrl);
const SUPABASE_EXPECTED_ISSUER = new URL('/auth/v1', rawSupabaseBaseUrl).toString().replace(/\/+$/, '');
console.log('[JWT] JWKS URL:', SUPABASE_JWKS_URL.toString());
const SUPABASE_JWT_SECRET = (process.env.SUPABASE_JWT_SECRET || '').trim();
let cachedHs256Secret;
const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

const hasCustomIssuerConfig = true;
const AUDIENCE = 'authenticated';
const JWKS_CACHE_TTL_MS = Number(process.env.SUPABASE_JWKS_CACHE_MS || 6 * 60 * 60 * 1000);
const jwksCache = new LRUCache({
  max: 1,
  ttl: JWKS_CACHE_TTL_MS,
});
const JWKS_CACHE_KEY = 'remote_jwks';
const getHs256SecretKey = () => {
  if (!SUPABASE_JWT_SECRET) {
    throw new Error('supabase_jwt_secret_missing');
  }
  if (!cachedHs256Secret) {
    if (!textEncoder) {
      throw new Error('text_encoder_unavailable');
    }
    cachedHs256Secret = textEncoder.encode(SUPABASE_JWT_SECRET);
  }
  return cachedHs256Secret;
};
const getRemoteJwks = () => {
  const cached = jwksCache.get(JWKS_CACHE_KEY);
  if (cached) return cached;
  const client = createRemoteJWKSet(SUPABASE_JWKS_URL);
  jwksCache.set(JWKS_CACHE_KEY, client);
  return client;
};
const logIssuerMismatch = (error) => {
  if (error?.code === 'ERR_JWT_CLAIM_INVALID' && error?.claim === 'iss') {
    console.warn('[supabaseJwt] issuer_mismatch', {
      expected: SUPABASE_EXPECTED_ISSUER,
      received: error?.claimValue,
    });
  }
};
const ensureValidPayload = (payload) => {
  if (!payload || !payload.sub) {
    throw new Error('invalid_payload');
  }
  return payload;
};

const shouldBypass = (path = '') => JWT_AUTH_BYPASS_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

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

const verifyHs256Token = async (token) => {
  try {
    const secretKey = getHs256SecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
      audience: AUDIENCE,
      issuer: SUPABASE_EXPECTED_ISSUER,
      clockTolerance: 5,
    });
    return ensureValidPayload(payload);
  } catch (error) {
    logIssuerMismatch(error);
    throw error;
  }
};

const verifyRs256Token = async (token) => {
  try {
    const remoteJwks = getRemoteJwks();
    const { payload } = await jwtVerify(token, remoteJwks, {
      algorithms: ['RS256'],
      audience: AUDIENCE,
      issuer: SUPABASE_EXPECTED_ISSUER,
      clockTolerance: 5,
    });
    return ensureValidPayload(payload);
  } catch (error) {
    logIssuerMismatch(error);
    if (error?.code && String(error.code).startsWith('ERR_JWKS')) {
      jwksCache.delete(JWKS_CACHE_KEY);
      console.error('[supabaseJwt] jwks_fetch_failed', {
        message: error.message,
        code: error.code,
      });
    }
    throw error;
  }
};

const getTokenAlgorithm = (token) => {
  try {
    const header = decodeProtectedHeader(token);
    return typeof header?.alg === 'string' ? header.alg : '';
  } catch (error) {
    console.warn('[supabaseJwt] token validation failed', 'header_decode_failed');
    throw error;
  }
};

const verifySupabaseToken = async (token) => {
  const alg = getTokenAlgorithm(token);
  const normalizedAlg = alg.toUpperCase();
  if (!normalizedAlg) {
    console.warn('[supabaseJwt] alg_mismatch', { alg: 'missing' });
    throw new Error('alg_missing');
  }
  if (normalizedAlg === 'NONE') {
    console.warn('[supabaseJwt] alg_mismatch', { alg: 'none' });
    throw new Error('alg_none_not_allowed');
  }
  if (normalizedAlg === 'HS256') {
    return verifyHs256Token(token);
  }
  if (normalizedAlg === 'RS256') {
    return verifyRs256Token(token);
  }
  console.warn('[supabaseJwt] alg_mismatch', { alg });
  throw new Error('alg_not_supported');
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
    console.warn('[supabaseJwt] token_missing');
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
