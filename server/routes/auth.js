/**
 * Authentication Routes
 * Login, register, token refresh, and logout endpoints
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.js';
import {
  authenticate,
  authLimiter,
  normalizeEmail,
  isCanonicalAdminEmail,
  resolveUserRole,
  mapMembershipRows,
} from '../middleware/auth.js';
import supabase, { supabaseAuthClient } from '../lib/supabaseClient.js';
import {
  attachAuthCookies,
  clearAuthCookies,
  getRefreshTokenFromRequest,
} from '../utils/authCookies.js';
import { doubleSubmitCSRF } from '../middleware/csrf.js';
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
    password: '3Cr0wns2014!',
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

const ORGANIZATION_VIEW_COLUMNS =
  'organization_id, role, status, organization_name, organization_status, subscription, features, accepted_at, last_seen_at';

const MEMBERSHIP_VIEW_NAME = 'user_organizations_vw';

const isMembershipViewMissingError = (error) =>
  Boolean(
    error &&
      (error.code === 'PGRST205' ||
        error.code === '42P01' ||
        (typeof error.message === 'string' && error.message.includes(MEMBERSHIP_VIEW_NAME))),
  );

const normalizeOrgId = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const fetchMembershipsFromBaseTables = async (userId) => {
  if (!supabase || !userId) return [];
  try {
    const { data: membershipRows, error } = await supabase
      .from('organization_memberships')
      .select('org_id, role, created_at, updated_at')
      .eq('user_id', userId);

    if (error) throw error;

    const rows = Array.isArray(membershipRows) ? membershipRows : [];
    const orgIds = Array.from(new Set(rows.map((row) => normalizeOrgId(row?.org_id)).filter(Boolean)));

    let orgMap = new Map();
    if (orgIds.length > 0) {
      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('id,name,status,subscription,features')
        .in('id', orgIds);

      if (orgError) throw orgError;
      orgMap = new Map((orgs || []).map((org) => [org.id, org]));
    }

    return rows.map((row) => {
      const organization = orgMap.get(normalizeOrgId(row?.org_id)) || {};
      return {
        organization_id: normalizeOrgId(row?.org_id),
        role: row?.role || 'member',
        status: 'active',
        organization_name: organization.name || null,
        organization_status: organization.status || null,
        subscription: organization.subscription ?? null,
        features: organization.features ?? null,
        accepted_at: row?.created_at || null,
        last_seen_at: row?.updated_at || null,
      };
    });
  } catch (error) {
    console.error('[AUTH ROUTES] organization_memberships fallback failed', { userId, error });
    return [];
  }
};

const fetchUserMembershipRows = async (userId) => {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('user_organizations_vw')
    .select(ORGANIZATION_VIEW_COLUMNS)
    .eq('user_id', userId);

  if (error) {
    if (isMembershipViewMissingError(error)) {
      console.warn('[AUTH ROUTES] user_organizations_vw missing, falling back to base tables', {
        userId,
        code: error.code,
        message: error.message,
      });
      return fetchMembershipsFromBaseTables(userId);
    }
    console.error('[AUTH ROUTES] Failed to fetch memberships', { userId, error });
    return [];
  }

  return data || [];
};

const buildTokenResponseFromSession = (session) => {
  if (!session) {
    return {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      refreshExpiresAt: null,
    };
  }

  const expiresAt = session.expires_at ? session.expires_at * 1000 : session.expires_in ? Date.now() + session.expires_in * 1000 : null;
  const refreshExpiresAt = expiresAt ? expiresAt + 30 * 24 * 60 * 60 * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000;

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt,
    refreshExpiresAt,
  };
};

const buildUserPayloadFromSupabase = (supabaseUser, memberships = []) => {
  const normalizedEmail = normalizeEmail(supabaseUser?.email || '');
  const membershipPayload = mapMembershipRows(memberships);
  const organizationIds = membershipPayload.filter((m) => m.status === 'active').map((m) => m.orgId);
  const platformRole = supabaseUser.app_metadata?.platform_role || null;
  let role = resolveUserRole(
    {
      email: normalizedEmail,
      role: supabaseUser?.role,
      app_metadata: supabaseUser?.app_metadata,
      user_metadata: supabaseUser?.user_metadata,
    },
    membershipPayload,
  );

  if (role === 'admin' && membershipPayload.length === 0 && !platformRole) {
    console.warn('[AUTH ROUTES] Suppressing admin role due to missing memberships', {
      userId: supabaseUser.id,
      email: normalizedEmail,
    });
    role = 'learner';
  }

  return {
    id: supabaseUser.id,
    userId: supabaseUser.id,
    email: normalizedEmail,
    role,
    firstName: supabaseUser.user_metadata?.first_name ?? null,
    lastName: supabaseUser.user_metadata?.last_name ?? null,
    organizationId: organizationIds[0] || null,
    organizationIds,
    memberships: membershipPayload,
    platformRole,
  };
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
        const normalizedEmail = normalizeEmail(demoUser.email);
        const resolvedRole = isCanonicalAdminEmail(normalizedEmail) ? 'admin' : demoUser.role || 'user';
        const tokens = generateTokens({
          userId: demoUser.id,
          email: normalizedEmail,
          role: resolvedRole,
          organizationId: demoUser.organizationId,
        });

        attachAuthCookies(res, tokens);
        
        return res.json({
          user: {
            id: demoUser.id,
            email: normalizedEmail,
            role: resolvedRole,
            firstName: demoUser.firstName,
            lastName: demoUser.lastName,
            organizationId: demoUser.organizationId,
          },
          ...tokens,
        });
      }
    }
    
    const normalizedEmail = normalizeEmail(email);
    const logPrefix = `[AUTH LOGIN] ${normalizedEmail}`;
    console.log(`${logPrefix} attempt from origin=${origin} ip=${ip}`);

    // Real authentication with Supabase
    if (!supabase || !supabaseAuthClient) {
      console.warn(`${logPrefix} Supabase client missing (service=${!!supabase} auth=${!!supabaseAuthClient})`);
      return res.status(503).json({
        error: 'Service unavailable',
        message:
          'Authentication service not configured. Configure Supabase credentials or set ALLOW_DEMO=true / DEMO_MODE=true to enable demo logins.',
      });
    }
    
    // Authenticate against Supabase Auth so "Last signed in" updates and Supabase role metadata applies
    const { data, error: authError } = await supabaseAuthClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError || !data?.user || !data.session) {
      const detailMessage = authError?.message || 'unknown error';
      console.warn(`${logPrefix} Supabase auth failed: ${detailMessage}`);
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
        details: detailMessage,
      });
    }

    console.info(`${logPrefix} Supabase auth success userId=${data.user.id}`);

    // Fetch profile info from internal users table (optional)
    let userRecord = null;
    try {
      const { data: users, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .limit(1);

      if (queryError) {
        console.warn(`${logPrefix} Failed to load profile row: ${queryError.message}`);
      } else if (users && users.length > 0) {
        userRecord = users[0];
        if (userRecord && userRecord.is_active === false) {
          console.warn(`${logPrefix} Profile marked inactive. Rejecting login.`);
          return res.status(403).json({
            error: 'Account disabled',
            message: 'Your account has been disabled',
          });
        }
      }
    } catch (profileError) {
      console.error(`${logPrefix} Unexpected profile lookup error:`, profileError);
    }

    const supabaseUser = data.user;
    const membershipRows = await fetchUserMembershipRows(supabaseUser.id);
    const userPayload = buildUserPayloadFromSupabase(supabaseUser, membershipRows);
    const tokens = buildTokenResponseFromSession(data.session);

    attachAuthCookies(res, tokens);

    console.log('[AUTH LOGIN] issuing supabase session for:', {
      userId: userPayload.userId,
      orgs: userPayload.organizationIds,
      role: userPayload.role,
    });

    return res.json({
      user: userPayload,
      memberships: userPayload.memberships,
      organizationIds: userPayload.organizationIds,
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
    const { email, password, firstName, lastName, organizationId } = req.body || {};

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'All fields are required',
      });
    }

    if (!supabase || !supabaseAuthClient) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Authentication service not configured',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const { data: existingUsers } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        error: 'User exists',
        message: 'An account with this email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let createdAuthUserId = null;
    try {
      const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          organization_id: organizationId ?? null,
        },
      });

      if (createAuthError) {
        const conflict = /already registered|exists/i.test(createAuthError.message || '');
        return res.status(conflict ? 409 : 400).json({
          error: conflict ? 'User exists' : 'Registration failed',
          message: createAuthError.message || 'Unable to create account',
        });
      }

      createdAuthUserId = authData?.user?.id || null;
      if (!createdAuthUserId) {
        throw new Error('Supabase auth did not return a user id');
      }
    } catch (error) {
      console.error('Supabase auth createUser failed:', error);
      return res.status(500).json({
        error: 'Registration failed',
        message: 'Unable to create account',
      });
    }

    try {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: createdAuthUserId,
          email: normalizedEmail,
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          role: 'user',
          is_active: true,
          organization_id: organizationId ?? null,
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('User creation error:', createError);
        await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => {});
        return res.status(500).json({
          error: 'Registration failed',
          message: 'Could not create account',
        });
      }

      const { data: sessionData, error: loginError } = await supabaseAuthClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (loginError || !sessionData?.session || !sessionData.user) {
        console.warn('[AUTH REGISTER] User created but automatic login failed, returning 201 without session');
        return res.status(201).json({
          user: {
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            organizationId: newUser.organization_id,
          },
          requiresLogin: true,
        });
      }

      const membershipRows = await fetchUserMembershipRows(sessionData.user.id);
      const userPayload = buildUserPayloadFromSupabase(sessionData.user, membershipRows);
      const tokens = buildTokenResponseFromSession(sessionData.session);

      attachAuthCookies(res, tokens);
      res.status(201).json({
        user: userPayload,
        memberships: userPayload.memberships,
        ...tokens,
      });
    } catch (error) {
      console.error('Registration persistence error:', error);
      if (createdAuthUserId) {
        await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => {});
      }
      res.status(500).json({
        error: 'Internal server error',
        message: 'An error occurred during registration',
      });
    }
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
    const refreshToken = getRefreshTokenFromRequest(req);

    if (!refreshToken) {
      return res.status(401).json({
        error: 'missing_refresh_token',
        message: 'Refresh token cookie is required',
      });
    }

    if (isDemoModeExplicit || isE2ETestMode) {
      const payload = verifyRefreshToken(refreshToken);
      if (!payload) {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Refresh token is invalid or expired',
        });
      }
      const tokens = generateTokens({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });
      attachAuthCookies(res, tokens);
      return res.json(tokens);
    }

    if (!supabaseAuthClient) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Authentication service not configured',
      });
    }

    const { data, error } = await supabaseAuthClient.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session || !data.user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: error?.message || 'Unable to refresh session',
      });
    }

    const membershipRows = await fetchUserMembershipRows(data.user.id);
    const userPayload = buildUserPayloadFromSupabase(data.user, membershipRows);
    const tokens = buildTokenResponseFromSession(data.session);

    attachAuthCookies(res, tokens);
    res.json({
      user: userPayload,
      memberships: userPayload.memberships,
      ...tokens,
    });
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
    memberships: req.user?.memberships || [],
    activeOrgId: req.activeOrgId || req.user?.organizationId || null,
  });
});

router.get('/session', authenticate, (req, res) => {
  res.json({
    user: req.user || null,
    memberships: req.user?.memberships || [],
    activeOrgId: req.activeOrgId || req.user?.organizationId || null,
  });
});

// ============================================================================
// Logout
// ============================================================================

router.post('/logout', doubleSubmitCSRF, async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);

    if (supabaseAuthClient && refreshToken) {
      try {
        await supabaseAuthClient.auth.signOut(refreshToken);
      } catch (error) {
        console.warn('[AUTH LOGOUT] Supabase signOut failed', error?.message || error);
      }
    }
  } finally {
    clearAuthCookies(res);
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
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
