/**
 * JWT Utilities
 * Token generation, verification, and refresh
 */

import jwt from 'jsonwebtoken';

// ============================================================================
// Configuration
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production-min-32-chars';
export const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.JWT_ACCESS_TTL_SECONDS || 15 * 60); // default 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = Number(
  process.env.JWT_REFRESH_TTL_SECONDS || 7 * 24 * 60 * 60
); // default 7 days
const JWT_EXPIRES_IN = ACCESS_TOKEN_TTL_SECONDS;
const REFRESH_TOKEN_EXPIRES_IN = REFRESH_TOKEN_TTL_SECONDS;

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate access token
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'lms-platform',
    audience: 'lms-users',
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload) {
  return jwt.sign(
    { userId: payload.userId, email: payload.email, role: payload.role },
    JWT_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      issuer: 'lms-platform',
      audience: 'lms-users',
    }
  );
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokens(payload) {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  
  const expiresAt = Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000;
  const refreshExpiresAt = Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000;
  
  return {
    accessToken,
    refreshToken,
    expiresAt,
    refreshExpiresAt,
  };
}

// ============================================================================
// Token Verification
// ============================================================================

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'lms-platform',
      audience: 'lms-users',
    });
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.log('Invalid token');
    }
    return null;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'lms-platform',
      audience: 'lms-users',
    });
    
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token) {
  return jwt.decode(token);
}

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader) {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return true;
    
    // Token is expired if exp is less than current time
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded?.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}
