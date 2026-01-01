/**
 * Authentication Routes
 * Login, register, token refresh, and logout endpoints
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.js';
import { authenticate, authLimiter } from '../middleware/auth.js';
import supabase from '../lib/supabaseClient.js';
import {
  attachAuthCookies,
  clearAuthCookies,
  getRefreshTokenFromRequest,
} from '../utils/authCookies.js';
import {
  demoLoginEnabled,
  E2E_TEST_MODE as e2eTestMode,
  allowLegacyDemoUsers as allowLegacyDemoUsersFlag,
  allowDemoExplicit,
  demoModeExplicit,
} from '../config/runtimeFlags.js';

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return fallback;
};

const isE2ETestMode = e2eTestMode;
const isDemoModeExplicit = demoModeExplicit || allowDemoExplicit;
const allowLegacyDemoUsers = allowLegacyDemoUsersFlag || isE2ETestMode;
const canUseDemoMode = demoLoginEnabled;

const legacyDemoUsers = [
  {
    id: '00000000-0000-0000-0000-000000000001',
  email: 'mya@the-huddle.co',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    password: 'admin123',
    organizationId: undefined,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'user@pacificcoast.edu',
    role: 'user',
    firstName: 'Demo',
    lastName: 'User',
    password: 'user123',
    organizationId: undefined,
  },
];

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const PRIMARY_ADMIN_EMAIL = normalizeEmail(process.env.PRIMARY_ADMIN_EMAIL || 'mya@the-huddle.co');

const isCanonicalAdminEmail = (email) => normalizeEmail(email) === PRIMARY_ADMIN_EMAIL;

const resolveUserRole = (user = {}) => {
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

const buildConfiguredDemoUsers = () => {
  const users = [];

  const fromEnv = (prefix, defaults) => {
    const email = process.env[`${prefix}_EMAIL`] || defaults.email;
    const password = process.env[`${prefix}_PASSWORD`];
    const passwordHash = process.env[`${prefix}_PASSWORD_HASH`];

    if (!email || (!password && !passwordHash)) {
      return;
    }

    users.push({
      id: process.env[`${prefix}_ID`] || defaults.id,
      email: email.trim(),
      emailLower: normalizeEmail(email),
      role: process.env[`${prefix}_ROLE`] || defaults.role,
      firstName: process.env[`${prefix}_FIRST_NAME`] || defaults.firstName,
      lastName: process.env[`${prefix}_LAST_NAME`] || defaults.lastName,
      organizationId: process.env[`${prefix}_ORG_ID`] || defaults.organizationId,
      password,
      passwordHash,
    });
  };

  fromEnv('DEMO_ADMIN', {
    id: '00000000-0000-0000-0000-000000000001',
  email: 'mya@the-huddle.co',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    organizationId: undefined,
  });

  fromEnv('DEMO_USER', {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'user@pacificcoast.edu',
    role: 'user',
    firstName: 'Demo',
    lastName: 'User',
    organizationId: undefined,
  });

  const rawJson = process.env.DEMO_USERS_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        parsed.forEach((entry) => {
          if (!entry?.email || (!entry.password && !entry.passwordHash)) {
            return;
          }
          users.push({
            id: entry.id || `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            email: entry.email,
            emailLower: normalizeEmail(entry.email),
            role: entry.role || 'user',
            firstName: entry.firstName || 'Demo',
            lastName: entry.lastName || 'User',
            organizationId: entry.organizationId,
            password: entry.password,
            passwordHash: entry.passwordHash,
          });
        });
      }
    } catch (error) {
      console.error('[AUTH ROUTES] Failed to parse DEMO_USERS_JSON:', error);
    }
  }

  return users;
};

const configuredDemoUsers = buildConfiguredDemoUsers();

if (isDemoModeExplicit && configuredDemoUsers.length === 0 && !allowLegacyDemoUsers) {
  console.warn(
    '[AUTH ROUTES] DEMO_MODE is enabled but no demo users are configured. Set DEMO_USERS_JSON or DEMO_ADMIN_PASSWORD / DEMO_ADMIN_PASSWORD_HASH to enable demo logins.'
  );
}

const matchLegacyDemoUser = async (email, password) => {
  const legacyUser = legacyDemoUsers.find((user) => normalizeEmail(user.email) === normalizeEmail(email));
  if (!legacyUser) return null;
  if (legacyUser.password && legacyUser.password === password) {
    return legacyUser;
  }
  return null;
};

const matchConfiguredDemoUser = async (email, password) => {
  const target = normalizeEmail(email);
  for (const user of configuredDemoUsers) {
    if (user.emailLower !== target) continue;
    if (user.passwordHash) {
      const match = await bcrypt.compare(password, user.passwordHash);
      if (match) return user;
    } else if (user.password && user.password === password) {
      return user;
    }
  }
  return null;
};

const resolveDemoUser = async (email, password) => {
  const configured = await matchConfiguredDemoUser(email, password);
  if (configured) return configured;
  if (allowLegacyDemoUsers) {
    return matchLegacyDemoUser(email, password);
  }
  return null;
};

const router = express.Router();

router.use((req, _res, next) => {
  const { method, originalUrl, headers } = req;
  console.log(`[AUTH ROUTER] ${method} ${originalUrl} origin=${headers.origin || 'n/a'}`);
  next();
});

// ============================================================================
// Login
// ============================================================================

router.post('/login', async (req, res) => {
  const origin = req.headers.origin || 'unknown';
  console.log(`[AUTH] Incoming ${req.method} ${req.originalUrl} from origin ${origin}`);
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required',
      });
    }
    
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    console.log(`[AUTH] ${req.method} ${req.originalUrl} from origin ${origin} ip ${ip}`);
    // Demo mode check
  const useDemoMode = canUseDemoMode;
    
    if (useDemoMode) {
      console.log('[AUTH ROUTES] Using demo mode authentication');
      const demoUser = await resolveDemoUser(email, password);
      
      if (demoUser) {
        const tokens = generateTokens({
          userId: demoUser.id,
          email: demoUser.email,
          role: demoUser.role,
          organizationId: demoUser.organizationId,
        });

        attachAuthCookies(res, tokens);
        
        return res.json({
          user: {
            id: demoUser.id,
            email: demoUser.email,
            role: demoUser.role,
            firstName: demoUser.firstName,
            lastName: demoUser.lastName,
            organizationId: demoUser.organizationId,
          },
          ...tokens,
        });
      }
    }
    
    // Real authentication with Supabase
    if (!supabase) {
      return res.status(503).json({
        error: 'Service unavailable',
        message:
          'Authentication service not configured. Configure Supabase credentials or set ALLOW_DEMO=true / DEMO_MODE=true to enable demo logins.',
      });
    }
    
    // Get user from database
    const { data: users, error: queryError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .limit(1);
    
    if (queryError || !users || users.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }
    
    const user = users[0];
    
    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Account disabled',
        message: 'Your account has been disabled',
      });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }
    
    // Generate tokens
    const resolvedRole = resolveUserRole(user);

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: resolvedRole,
      organizationId: user.organization_id,
    });
    
    // Return user data and tokens
    attachAuthCookies(res, tokens);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: resolvedRole,
        firstName: user.first_name,
        lastName: user.last_name,
        organizationId: user.organization_id,
      },
      ...tokens,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during login',
    });
  }
});

// ============================================================================
// Register
// ============================================================================

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'All fields are required',
      });
    }
    
    if (!supabase) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Authentication service not configured',
      });
    }
    
    // Check if user already exists
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .limit(1);
    
    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        error: 'User exists',
        message: 'An account with this email already exists',
      });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role: 'user', // Default role
        is_active: true,
      })
      .select()
      .single();
    
    if (createError || !newUser) {
      console.error('User creation error:', createError);
      return res.status(500).json({
        error: 'Registration failed',
        message: 'Could not create account',
      });
    }
    
    // Generate tokens
    const tokens = generateTokens({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });
    
    // Return user data and tokens
    attachAuthCookies(res, tokens);
    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
      },
      ...tokens,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during registration',
    });
  }
});

// ============================================================================
// Token Refresh
// ============================================================================

router.post('/refresh', async (req, res) => {
  try {
    let { refreshToken } = req.body || {};
    if (!refreshToken) {
      refreshToken = getRefreshTokenFromRequest(req);
    }
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Missing token',
        message: 'Refresh token is required',
      });
    }
    
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    
    if (!payload) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Refresh token is invalid or expired',
      });
    }
    
    // Demo mode - skip database check
    if (isDemoModeExplicit || isE2ETestMode) {
      const tokens = generateTokens({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });
      attachAuthCookies(res, tokens);
      return res.json(tokens);
    }
    
    // Get user from database
    if (!supabase) {
      return res.status(503).json({
        error: 'Service unavailable',
      });
    }
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.userId)
      .single();
    
    if (userError || !user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Invalid refresh token',
      });
    }
    
    // Check if user is still active
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Account disabled',
      });
    }
    
    // Generate new tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    });
    
    attachAuthCookies(res, tokens);
    res.json(tokens);
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during token refresh',
    });
  }
});

// ============================================================================
// Verify Token
// ============================================================================

router.get('/verify', authenticate, async (req, res) => {
  // If we got here, token is valid (authenticate middleware succeeded)
  res.json({
    valid: true,
    user: req.user,
  });
});

// ============================================================================
// Logout
// ============================================================================

router.post('/logout', authenticate, async (req, res) => {
  // In a real implementation, you might want to blacklist the token
  // For now, just send success response
  // Client will clear tokens from storage
  clearAuthCookies(res);
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// ============================================================================
// Get Current User
// ============================================================================

router.get('/me', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      });
    }
    
    if (!supabase || isDemoModeExplicit || isE2ETestMode) {
      // Return token data in demo mode
      return res.json({
        user: req.user,
      });
    }
    
    // Get fresh user data from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, organization_id, is_active')
      .eq('id', req.user.userId)
      .single();
    
    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        organizationId: user.organization_id,
        isActive: user.is_active,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;
