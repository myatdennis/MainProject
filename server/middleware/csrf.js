/**
 * CSRF Protection Middleware
 * Modern implementation to replace deprecated csurf
 */

import crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Store for CSRF tokens (in production, use Redis or similar)
const tokenStore = new Map();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of tokenStore.entries()) {
    if (value.expires < now) {
      tokenStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate a secure random CSRF token
 */
export function generateCSRFToken() {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('base64url');
}

/**
 * Create a session-based CSRF token
 */
function createSessionToken(sessionId) {
  const token = generateCSRFToken();
  const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  tokenStore.set(sessionId, { token, expires });
  return token;
}

/**
 * Get session ID from request (using cookie or session)
 */
function getSessionId(req) {
  // Try to get from cookie
  if (req.cookies?.session_id) {
    return req.cookies.session_id;
  }
  
  // Generate new session ID
  const sessionId = generateCSRFToken();
  return sessionId;
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * CSRF protection middleware
 * Verifies CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
 */
export function csrfProtection(req, res, next) {
  const sessionId = getSessionId(req);
  
  // Safe methods don't require CSRF protection
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Get token from header or body
  const token = req.headers[CSRF_HEADER_NAME] || req.body?._csrf;
  
  if (!token) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'CSRF token is required for this request',
    });
  }
  
  // Verify token
  const storedToken = tokenStore.get(sessionId);
  
  if (!storedToken) {
    return res.status(403).json({
      error: 'Invalid session',
      message: 'No CSRF token found for this session',
    });
  }
  
  if (storedToken.expires < Date.now()) {
    tokenStore.delete(sessionId);
    return res.status(403).json({
      error: 'CSRF token expired',
      message: 'Please refresh and try again',
    });
  }
  
  if (storedToken.token !== token) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token validation failed',
    });
  }
  
  next();
}

/**
 * Generate and set CSRF token cookie
 */
export function setCSRFToken(req, res, next) {
  const sessionId = getSessionId(req);
  
  // Get or create token
  let tokenData = tokenStore.get(sessionId);
  
  if (!tokenData || tokenData.expires < Date.now()) {
    const token = createSessionToken(sessionId);
    tokenData = { token, expires: Date.now() + (24 * 60 * 60 * 1000) };
  }
  
  // Set session ID cookie if not exists
  if (!req.cookies?.session_id) {
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }
  
  // Expose token to client (not httpOnly so JS can read it)
  res.cookie(CSRF_COOKIE_NAME, tokenData.token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
  
  next();
}

// ============================================================================
// Token Endpoint
// ============================================================================

/**
 * Get CSRF token endpoint
 */
export function getCSRFToken(req, res) {
  const sessionId = getSessionId(req);
  let tokenData = tokenStore.get(sessionId);
  
  if (!tokenData || tokenData.expires < Date.now()) {
    const token = createSessionToken(sessionId);
    tokenData = { token, expires: Date.now() + (24 * 60 * 60 * 1000) };
  }
  
  res.json({
    csrfToken: tokenData.token,
  });
}

// ============================================================================
// Double Submit Cookie Pattern
// ============================================================================

/**
 * Alternative CSRF protection using double-submit cookie pattern
 * This doesn't require server-side storage
 */
export function doubleSubmitCSRF(req, res, next) {
  // Safe methods don't require CSRF protection
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];
  
  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'CSRF protection requires both cookie and header token',
    });
  }
  
  if (cookieToken !== headerToken) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token mismatch',
    });
  }
  
  next();
}

/**
 * Set CSRF cookie for double-submit pattern
 */
export function setDoubleSubmitCSRF(req, res, next) {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    const token = generateCSRFToken();
    
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Client needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }
  
  next();
}
