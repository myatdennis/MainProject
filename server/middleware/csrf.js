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
function getCsrfCookieOptions(req, { httpOnly = false, name } = {}) {
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
 * If not present, generate and set a new session_id cookie with correct options.
 */
function getSessionId(req, res) {
  if (req.cookies?.session_id) return req.cookies.session_id;
  const sessionId = generateCSRFToken();
  if (res) {
    res.cookie('session_id', sessionId, {
      ...getCsrfCookieOptions(req, { httpOnly: true, name: 'session_id' }),
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
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
  const sessionId = getSessionId(req, res);
  
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
  const sessionId = getSessionId(req, res);
  // Get or create token
  let tokenData = tokenStore.get(sessionId);
  if (!tokenData || tokenData.expires < Date.now()) {
    const token = createSessionToken(sessionId);
    tokenData = { token, expires: Date.now() + (24 * 60 * 60 * 1000) };
  }
  // Expose token to client (not httpOnly so JS can read it)
  res.cookie(CSRF_COOKIE_NAME, tokenData.token, {
    ...getCsrfCookieOptions(req, { httpOnly: false, name: CSRF_COOKIE_NAME }),
    maxAge: 24 * 60 * 60 * 1000,
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
  const sessionId = getSessionId(req, res);
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
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
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
      ...getCsrfCookieOptions(req, { httpOnly: false, name: CSRF_COOKIE_NAME }),
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  next();
}
