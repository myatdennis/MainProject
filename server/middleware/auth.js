/**
 * Authentication Middleware
 * Server-side authentication and authorization
 */

import rateLimit from 'express-rate-limit';
import { verifyAccessToken, extractTokenFromHeader } from '../utils/jwt.js';
import { getAccessTokenFromRequest } from '../utils/authCookies.js';
import { E2E_TEST_MODE, DEV_FALLBACK } from '../config/runtimeFlags.js';

export const normalizeEmail = (value = '') => value.trim().toLowerCase();
// Make sure PRIMARY_ADMIN_EMAIL is set in .env to 'mya@the-huddle.co'
export const PRIMARY_ADMIN_EMAIL = normalizeEmail(process.env.PRIMARY_ADMIN_EMAIL || 'mya@the-huddle.co');

export const isCanonicalAdminEmail = (email) => normalizeEmail(email) === PRIMARY_ADMIN_EMAIL;

export const resolveUserRole = (user = {}) => {
  const email = normalizeEmail(user.email || '');
  if (email && isCanonicalAdminEmail(email)) {
    return 'admin';
  }

  const metadataRole =
    user.role ||
    user.user_metadata?.role ||
    user.app_metadata?.role ||
    (user.user_metadata?.is_admin || user.app_metadata?.is_admin ? 'admin' : undefined);

  return metadataRole || 'user';
};

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
 * Verify JWT token and attach user to request
 */
export function authenticate(req, res, next) {
  let token = extractTokenFromHeader(req.headers.authorization);
  if (!token) {
    token = getAccessTokenFromRequest(req);
  }

  const allowDemoBypass = E2E_TEST_MODE || DEV_FALLBACK;
  if (!token && allowDemoBypass) {
    req.user = {
      id: 'demo-admin',
      userId: 'demo-admin',
      role: 'admin',
      email: 'demo-admin@localhost',
      organizationId: 'demo-org',
    };
    return next();
  }
  
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No token provided',
    });
  }
  
  const payload = verifyAccessToken(token);
  
  if (!payload) {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Token is invalid or expired',
    });
  }
  
  // Attach user to request
  req.user = payload;

  if (req.user?.email) {
    req.user.email = normalizeEmail(req.user.email);
  }

  if (req.user?.email && isCanonicalAdminEmail(req.user.email)) {
    req.user.role = 'admin';
  }

  if (!req.user.userId && req.user.id) {
    req.user.userId = req.user.id;
  }

  next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuthenticate(req, res, next) {
  let token = extractTokenFromHeader(req.headers.authorization);
  if (!token) {
    token = getAccessTokenFromRequest(req);
  }
  
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  
  next();
}

// ============================================================================
// Authorization Middleware
// ============================================================================

/**
 * Require specific role(s)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Must be logged in',
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }
    
    next();
  };
}

/**
 * Require admin role
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Must be logged in',
    });
  }

  if (req.user.role === 'admin' || isCanonicalAdminEmail(req.user.email)) {
    return next();
  }

  console.warn('[requireAdmin] Access denied for user:', req.user);

  return res.status(403).json({
    error: 'Forbidden',
    message: 'Admin access required',
  });
}


/**
 * Require user to be authenticated (any role)
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Must be logged in',
    });
  }
  next();
}

/**
 * Require user to own the resource or be an admin
 */
export function requireOwnerOrAdmin(getUserId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }
    
    const resourceUserId = getUserId(req);
    
    // Allow if admin or resource owner
    if (req.user.role === 'admin' || req.user.userId === resourceUserId) {
      return next();
    }
    
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own resources',
    });
  };
}

/**
 * Require user to be in the same organization or be an admin
 */
export function requireSameOrganizationOrAdmin(getOrganizationId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }
    
    // Admins can access all organizations
    if (req.user.role === 'admin') {
      return next();
    }
    
    const resourceOrgId = getOrganizationId(req);
    
    if (!resourceOrgId || resourceOrgId === req.user.organizationId) {
      return next();
    }
    
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access resources in your organization',
    });
  };
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many attempts',
    message: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Rate limiter for API endpoints
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // 500 requests per minute (increased for development)
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for auth endpoints in development
    if (process.env.NODE_ENV !== 'production' && req.path.includes('/auth/')) {
      return true;
    }
    return false;
  },
});

/**
 * Strict rate limiter for sensitive operations
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests for this operation.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// Security Headers
// ============================================================================

/**
 * Add security headers to response
 */
export function securityHeaders(req, res, next) {
  // Prevent clickjacking (SAMEORIGIN still protects from framing by other sites
  // but allows same-origin frames if needed). Change via env if you need
  // a different policy.
  res.setHeader('X-Frame-Options', process.env.X_FRAME_OPTIONS || 'SAMEORIGIN');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy - relaxed for dev mode
  if (process.env.NODE_ENV === 'production') {
    // Allow embedding of trusted frame sources (e.g. YouTube) while keeping
    // a sensible default for other directives. You can override via
    // ALLOWED_FRAME_SRC env (space-separated origins) and FRAME_ANCESTORS.
    const allowedFrameSrc = process.env.ALLOWED_FRAME_SRC || 'https://www.youtube.com https://www.youtube-nocookie.com';
    const frameAncestors = process.env.FRAME_ANCESTORS || "'self'";

    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https:; " +
      `frame-src ${allowedFrameSrc}; ` +
      `child-src ${allowedFrameSrc}; ` +
      `frame-ancestors ${frameAncestors};`
    );
  }
  
  // Strict Transport Security (HTTPS only)
  if (req.secure && process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
}

// ============================================================================
// Request Logging
// ============================================================================

/**
 * Log authenticated requests
 */
export function logAuthRequest(req, res, next) {
  if (req.user) {
    console.log(`[AUTH] ${req.method} ${req.path} - User: ${req.user.email} (${req.user.role})`);
  }
  next();
}

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Handle authentication errors
 */
export function authErrorHandler(err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication failed',
    });
  }
  
  next(err);
}
