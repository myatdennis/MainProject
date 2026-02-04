import jwt from 'jsonwebtoken';
import {
  extractTokenFromHeader,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './tokenUtils.js';

const ISSUER = process.env.JWT_ISSUER || 'the-huddle-api';
const AUDIENCE = process.env.JWT_AUDIENCE || 'the-huddle-clients';
const ACCESS_SECRET = (process.env.JWT_SECRET || '').trim();
const REFRESH_SECRET = (process.env.JWT_REFRESH_SECRET || ACCESS_SECRET).trim();

const ensureAccessSecret = () => {
  if (!ACCESS_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return ACCESS_SECRET;
};

const ensureRefreshSecret = () => {
  if (!REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is not configured');
  }
  return REFRESH_SECRET;
};

export const isJwtSecretConfigured = Boolean(ACCESS_SECRET);

const normalizeClaims = (claims = {}) => ({
  userId: claims.userId || claims.id || null,
  email: claims.email || null,
  role: claims.role || 'learner',
  organizationId: claims.organizationId ?? null,
  platformRole: claims.platformRole ?? null,
});

export const signToken = (payload, options = {}) =>
  jwt.sign(payload, ensureAccessSecret(), { algorithm: 'HS256', ...options });

export const verifyToken = (token, options = {}) => {
  if (!token) return null;
  try {
    return jwt.verify(token, ensureAccessSecret(), options);
  } catch {
    return null;
  }
};

export const generateTokens = (claims = {}) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const accessTtl = Math.max(30, Number(ACCESS_TOKEN_TTL_SECONDS || 0) || 900);
  const refreshTtl = Math.max(60, Number(REFRESH_TOKEN_TTL_SECONDS || 0) || 604800);
  const payload = normalizeClaims(claims);

  const accessToken = jwt.sign(
    { ...payload, type: 'access', iss: ISSUER, aud: AUDIENCE },
    ensureAccessSecret(),
    { expiresIn: accessTtl, algorithm: 'HS256' },
  );

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    ensureRefreshSecret(),
    { expiresIn: refreshTtl, algorithm: 'HS256' },
  );

  return {
    accessToken,
    refreshToken,
    expiresAt: (nowSeconds + accessTtl) * 1000,
    refreshExpiresAt: (nowSeconds + refreshTtl) * 1000,
  };
};

const mapDecodedPayload = (decoded) => {
  if (!decoded || typeof decoded !== 'object') return null;
  return {
    userId: decoded.userId || decoded.sub || null,
    email: decoded.email || null,
    role: decoded.role || 'learner',
    organizationId: decoded.organizationId ?? null,
    platformRole: decoded.platformRole ?? null,
  };
};

export const verifyAccessToken = (token) => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, ensureAccessSecret());
    if (decoded?.type && decoded.type !== 'access') {
      return null;
    }
    return mapDecodedPayload(decoded);
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (token) => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, ensureRefreshSecret());
    if (decoded?.type && decoded.type !== 'refresh') {
      return null;
    }
    return mapDecodedPayload(decoded);
  } catch {
    return null;
  }
};

export { extractTokenFromHeader };
