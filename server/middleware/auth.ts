/**
 * Authentication Middleware
 * Server-side authentication and authorization
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader, TokenPayload } from '../utils/jwt';

// Extend Express Request to include user
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
 * Verify JWT token and attach user to request
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromHeader(req.headers.authorization);
  
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
  next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromHeader(req.headers.authorization);
  
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
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
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
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole('admin')(req, res, next);
}

/**
 * Require user to be authenticated (any role)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
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
export function requireOwnerOrAdmin(getUserId: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction) => {
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
export function requireSameOrganizationOrAdmin(
  getOrganizationId: (req: Request) => string | undefined
) {
  return (req: Request, res: Response, next: NextFunction) => {
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

import rateLimit from 'express-rate-limit';

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
  max: 100, // 100 requests per minute
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
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
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'none';"
  );
  
  // Strict Transport Security (HTTPS only)
  if (req.secure) {
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
export function logAuthRequest(req: Request, res: Response, next: NextFunction) {
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
export function authErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication failed',
    });
  }
  
  next(err);
}
