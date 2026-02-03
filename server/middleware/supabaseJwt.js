import { createPublicKey } from 'crypto';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { extractTokenFromHeader } from '../utils/jwt.js';
import { getAccessTokenFromRequest } from '../utils/authCookies.js';

const SUPABASE_JWKS_URL =
  'https://miqzywzuqzeffqpiupjm.supabase.co/auth/v1/.well-known/jwks.json';
const SUPABASE_ISSUER = 'https://miqzywzuqzeffqpiupjm.supabase.co/auth/v1';
const SUPABASE_AUDIENCE = 'authenticated';
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let jwksCache = { keys: [], fetchedAt: 0 };
const pemCache = new Map();

const createAuthError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const loadJwks = async () => {
  const now = Date.now();
  if (jwksCache.keys.length && now - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys;
  }

  const response = await fetch(SUPABASE_JWKS_URL);
  if (!response.ok) {
    throw createAuthError('jwks_fetch_failed', 'Unable to download Supabase JWKS');
  }

  const payload = await response.json();
  const keys = Array.isArray(payload?.keys) ? payload.keys : [];
  jwksCache = { keys, fetchedAt: now };
  return keys;
};

const getJwkForKid = async (kid) => {
  if (!kid) return null;
  const keys = await loadJwks();
  return keys.find((entry) => entry.kid === kid) || null;
};

const getPemForJwk = (jwk) => {
  if (!jwk?.kid) return null;
  const cached = pemCache.get(jwk.kid);
  if (cached) return cached;
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  pemCache.set(jwk.kid, pem);
  return pem;
};

const verifySupabaseJwt = async (token) => {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid) {
    throw createAuthError('invalid_token', 'Token missing key id');
  }

  const jwk = await getJwkForKid(decoded.header.kid);
  if (!jwk) {
    throw createAuthError('invalid_token', 'Signing key not found for token');
  }

  const pem = getPemForJwk(jwk);
  if (!pem) {
    throw createAuthError('invalid_token', 'Unable to construct signing key');
  }

  try {
    const claims = jwt.verify(token, pem, {
      audience: SUPABASE_AUDIENCE,
      issuer: SUPABASE_ISSUER,
      algorithms: ['RS256'],
    });
    return claims;
  } catch (error) {
    throw createAuthError('invalid_token', error.message || 'Invalid authentication token');
  }
};

const resolveTokenFromRequest = (req) => {
  const headerToken = extractTokenFromHeader(req.headers?.authorization);
  if (headerToken) {
    return headerToken;
  }
  const cookieToken = getAccessTokenFromRequest(req);
  if (cookieToken) {
    return cookieToken;
  }
  return null;
};

const buildUserFromClaims = (claims) => {
  const normalizedRole =
    claims?.role ||
    claims?.user_role ||
    claims?.app_metadata?.role ||
    claims?.app_metadata?.platform_role ||
    null;

  return {
    id: claims?.sub || null,
    email: claims?.email || claims?.user_metadata?.email || null,
    role: normalizedRole,
  };
};

export async function supabaseJwtMiddleware(req, res, next) {
  try {
    const token = resolveTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided (header or cookie)',
      });
    }

    const claims = await verifySupabaseJwt(token);
    req.supabaseJwtClaims = claims;
    req.supabaseJwtToken = token;
    const user = buildUserFromClaims(claims);
    req.user = user;
    return next();
  } catch (error) {
    if (error?.code === 'missing_token') {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided (header or cookie)',
      });
    }

    if (error?.code === 'jwks_fetch_failed') {
      console.error('[supabaseJwt] Unable to fetch JWKS', {
        message: error.message,
      });
    }

    return res.status(401).json({
      error: 'Authentication required',
      message:
        error?.code === 'invalid_token'
          ? 'Invalid authentication token'
          : error?.message || 'Unable to verify authentication token',
    });
  }
}

export default supabaseJwtMiddleware;
