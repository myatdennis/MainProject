/**
 * Authentication Routes
 * Login, register, token refresh, and logout endpoints
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { generateTokens, verifyRefreshToken, isJwtSecretConfigured } from '../utils/jwt.js';
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
import { getSupabaseConfig } from '../config/supabaseConfig.js';

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

const findAnyDemoUserByEmail = (email) => {
  if (!email) return null;
  const normalized = normalizeEmail(email);
  return (
    configuredDemoUsers.find((user) => user.emailLower === normalized) ||
    legacyDemoUsers.find((user) => normalizeEmail(user.email) === normalized) ||
    null
  );
};

const buildDemoUserPayloadFromToken = (tokenPayload = {}) => {
  const normalizedEmail = normalizeEmail(tokenPayload.email || '');
  const demoUser = findAnyDemoUserByEmail(normalizedEmail) || {};
  const id = demoUser.id || tokenPayload.userId || `demo-${normalizedEmail || 'user'}`;
  const role = demoUser.role || tokenPayload.role || 'user';
  const organizationId = demoUser.organizationId || null;
  const memberships = organizationId
    ? [
        {
          orgId: organizationId,
          organizationId,
          role,
          status: 'active',
          organizationName: demoUser.organizationName || null,
          organizationStatus: 'active',
          subscription: demoUser.subscription ?? null,
          features: demoUser.features ?? null,
          acceptedAt: null,
          lastSeenAt: null,
        },
      ]
    : [];

  return {
    id,
    userId: id,
    email: normalizedEmail || tokenPayload.email || `${id}@demo.local`,
    role,
    platformRole: role === 'admin' ? 'platform_admin' : null,
    isPlatformAdmin: role === 'admin',
    organizationId,
    organizationIds: organizationId ? [organizationId] : [],
    memberships,
    firstName: demoUser.firstName || null,
    lastName: demoUser.lastName || null,
    appMetadata: {},
    userMetadata: {},
  };
};

const buildAuthConfigError = () => {
  const config = getSupabaseConfig();
  return {
    status: config.error?.status || 503,
    error: 'AUTH_NOT_CONFIGURED',
    code: 'AUTH_NOT_CONFIGURED',
    message:
      config.error?.message ||
      'Authentication service not configured. Configure Supabase credentials or enable ALLOW_DEMO/DEMO_MODE for demo logins.',
    missingEnv: config.missing,
    hint: 'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) and SUPABASE_ANON_KEY on the server.',
  };
};

const buildJwtConfigError = () => ({
  status: 500,
  error: 'JWT_NOT_CONFIGURED',
  code: 'JWT_NOT_CONFIGURED',
  message: 'JWT secret is not configured. Set JWT_SECRET to a random 32+ character value on the server.',
  missingEnv: ['JWT_SECRET'],
});

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

const buildSessionResponse = (userPayload, tokens = {}) => ({
  user: userPayload,
  memberships: userPayload?.memberships || [],
  organizationIds: userPayload?.organizationIds || [],
  activeOrgId: userPayload?.organizationId || null,
  accessToken: tokens.accessToken ?? null,
  refreshToken: tokens.refreshToken ?? null,
  expiresAt: tokens.expiresAt ?? null,
  refreshExpiresAt: tokens.refreshExpiresAt ?? null,
});

const refreshSessionFromCookies = async (req, res) => {
  if (!isJwtSecretConfigured) {
    const jwtError = buildJwtConfigError();
    return {
      ok: false,
      status: jwtError.status,
      error: jwtError.error,
      code: jwtError.code,
      message: jwtError.message,
      missingEnv: jwtError.missingEnv,
    };
  }
  const refreshToken = getRefreshTokenFromRequest(req);

  if (!refreshToken) {
    return {
      ok: false,
      status: 401,
      error: 'missing_refresh_token',
      message: 'Refresh token cookie is required',
    };
  }

  if (isDemoModeExplicit || isE2ETestMode) {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return {
        ok: false,
        status: 401,
        error: 'Invalid token',
        message: 'Refresh token is invalid or expired',
      };
    }
    const tokens = generateTokens({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });
    attachAuthCookies(res, tokens, req);
    const userPayload = buildDemoUserPayloadFromToken(payload);
    return {
      ok: true,
      body: buildSessionResponse(userPayload, tokens),
    };
  }

  if (!supabaseAuthClient) {
    const configError = buildAuthConfigError();
    return {
      ok: false,
      status: configError.status,
      error: configError.error,
      code: configError.code,
      message: configError.message,
      missingEnv: configError.missingEnv,
    };
  }

  const { data, error } = await supabaseAuthClient.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session || !data.user) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid token',
      message: error?.message || 'Unable to refresh session',
    };
  }

  const membershipRows = await fetchUserMembershipRows(data.user.id);
  const userPayload = buildUserPayloadFromSupabase(data.user, membershipRows);
  const tokens = buildTokenResponseFromSession(data.session);

  attachAuthCookies(res, tokens, req);

  return {
    ok: true,
    body: buildSessionResponse(userPayload, tokens),
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
  if (!isJwtSecretConfigured) {
    const jwtError = buildJwtConfigError();
    return res.status(jwtError.status).json(jwtError);
  }
  const origin = req.headers.origin || 'unknown';
  if (process.env.DEBUG_AUTH === 'true') {
    console.log('[DEBUG_AUTH] Entered /api/auth/login', {
      method: req.method,
      url: req.originalUrl,
      host: req.headers.host,
      x_forwarded_host: req.headers['x-forwarded-host'],
      hostname: req.hostname
    });
  }
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        code: 'MISSING_CREDENTIALS',
        error: 'missing_credentials',
        message: 'Email and password are required',
      });
    }
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('[DEBUG_AUTH] login input', { email, ip });
    }
    const useDemoMode = canUseDemoMode;
    if (useDemoMode) {
      if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Using demo mode authentication');
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
        attachAuthCookies(req, res, tokens);
        if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Demo tokens issued, cookies set');
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
    if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Attempting Supabase login', { normalizedEmail, origin, ip });
    if (!supabase || !supabaseAuthClient) {
      if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Supabase client missing');
      const configError = buildAuthConfigError();
      return res.status(configError.status).json(configError);
    }
    const { data, error: authError } = await supabaseAuthClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (authError || !data?.user || !data.session) {
      const detailMessage = authError?.message || 'unknown error';
      // Safe log for failed login (mask password)
      console.warn('[AUTH LOGIN FAILURE]', {
        email: normalizedEmail,
        ip,
        error: detailMessage,
        at: 'supabaseAuthClient.auth.signInWithPassword',
      });
      if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Supabase auth failed', { detailMessage });
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        error: 'invalid_credentials',
        message: 'Email or password is incorrect',
      });
    }
    if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Supabase auth success', { userId: data.user.id });
    let userRecord = null;
    try {
      const { data: users, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .limit(1);
      if (queryError) {
        if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Failed to load profile row', { queryError });
        // Log DB error
        console.warn('[AUTH LOGIN DB ERROR]', {
          email: normalizedEmail,
          ip,
          error: queryError?.message,
          at: 'supabase.from(users).select',
        });
      } else if (users && users.length > 0) {
        userRecord = users[0];
        if (userRecord && userRecord.is_active === false) {
          if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Profile marked inactive');
          console.warn('[AUTH LOGIN INACTIVE]', {
            email: normalizedEmail,
            ip,
            at: 'userRecord.is_active === false',
          });
          return res.status(403).json({
            code: 'ACCOUNT_DISABLED',
            error: 'account_disabled',
            message: 'Your account has been disabled',
          });
        }
      }
    } catch (profileError) {
      if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Profile lookup error', { profileError });
      // Log unexpected DB/profile error
      console.error('[AUTH LOGIN PROFILE ERROR]', {
        email: normalizedEmail,
        ip,
        error: profileError instanceof Error ? profileError.message : profileError,
        at: 'profile lookup',
      });
    }
    const supabaseUser = data.user;
    const membershipRows = await fetchUserMembershipRows(supabaseUser.id);
    const userPayload = buildUserPayloadFromSupabase(supabaseUser, membershipRows);
    const tokens = buildTokenResponseFromSession(data.session);
    attachAuthCookies(req, res, tokens);
    if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Tokens issued, cookies set', { userId: userPayload.userId });
    return res.json({
      user: userPayload,
      memberships: userPayload.memberships,
      organizationIds: userPayload.organizationIds,
      ...tokens,
    });
  } catch (error) {
    // Mask sensitive info in logs
    const safeError = error instanceof Error ? error.message : error;
    const safeEmail = req.body?.email ? String(req.body.email).replace(/(.{2}).+(@.*)/, '$1***$2') : undefined;
    console.error('[AUTH LOGIN ERROR]', {
      error: safeError,
      email: safeEmail,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      at: 'catch',
    });
    res.status(500).json({
      code: 'LOGIN_FAILED',
      error: 'login_failed',
      message: 'An unexpected error occurred during login. Please try again.',
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
        code: 'REGISTRATION_FIELDS_MISSING',
        error: 'missing_fields',
        message: 'All fields are required',
      });
    }

    if (!supabase || !supabaseAuthClient) {
      const configError = buildAuthConfigError();
      return res.status(configError.status).json(configError);
    }

    const normalizedEmail = normalizeEmail(email);

    const { data: existingUsers } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        code: 'USER_EXISTS',
        error: 'user_exists',
        message: 'An account with this email already exists.',
        errors: { email: 'An account with this email already exists.' },
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
          code: conflict ? 'USER_EXISTS' : 'REGISTRATION_FAILED',
          error: conflict ? 'user_exists' : 'registration_failed',
          message: createAuthError.message || 'Unable to create account',
          errors: conflict ? { email: 'An account with this email already exists.' } : undefined,
        });
      }

      createdAuthUserId = authData?.user?.id || null;
      if (!createdAuthUserId) {
        throw new Error('Supabase auth did not return a user id');
      }
    } catch (error) {
      console.error('Supabase auth createUser failed:', error);
      return res.status(500).json({
        code: 'REGISTRATION_FAILED',
        error: 'registration_failed',
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
          code: 'REGISTRATION_FAILED',
          error: 'registration_failed',
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
          ok: true,
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

  attachAuthCookies(req, res, tokens);
      res.status(201).json({
        ok: true,
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
        code: 'REGISTRATION_FAILED',
        error: 'registration_failed',
        message: 'An error occurred during registration',
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      code: 'REGISTRATION_FAILED',
      error: 'registration_failed',
      message: 'An error occurred during registration',
    });
  }
});

// ============================================================================
// Token Refresh
// ============================================================================

router.post('/refresh', async (req, res) => {
  if (process.env.DEBUG_AUTH === 'true') {
    console.log('[DEBUG_AUTH] Entered /api/auth/refresh', {
      method: req.method,
      url: req.originalUrl,
      host: req.headers.host,
      x_forwarded_host: req.headers['x-forwarded-host'],
      hostname: req.hostname
    });
  }
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('[DEBUG_AUTH] refresh_token from cookie:', refreshToken ? '[present]' : '[missing]');
    }
    if (!refreshToken) {
      if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] No refresh_token, rejecting');
      // Log missing token
      console.warn('[AUTH REFRESH FAILURE] Missing refresh token', {
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        at: 'getRefreshTokenFromRequest',
      });
      return res.status(401).json({
        code: 'MISSING_REFRESH_TOKEN',
        error: 'missing_refresh_token',
        message: 'Refresh token cookie is required',
      });
    }
    const result = await refreshSessionFromCookies(req, res);
    if (!result.ok) {
      if ((result.status || 401) === 401 && result.error !== 'missing_refresh_token') {
        clearAuthCookies(req, res);
      }
      if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Refresh failed', { error: result.error, message: result.message });
      // Log refresh failure (mask token)
      console.warn('[AUTH REFRESH FAILURE]', {
        error: result.error,
        message: result.message,
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        at: 'refreshSessionFromCookies',
      });
      // Defensive: always return a structured error
      return res.status(result.status || 401).json({
        error: result.error || 'refresh_failed',
        code: result.code || result.error || 'refresh_failed',
        message: result.message || 'Unable to refresh session',
      });
    }
    if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Refresh success');
    return res.json(result.body);
  } catch (error) {
    // Mask sensitive info in logs
    const safeError = error instanceof Error ? error.message : error;
    console.error('[AUTH REFRESH ERROR]', {
      error: safeError,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      at: 'catch',
    });
    clearAuthCookies(req, res);
    res.status(500).json({
      code: 'REFRESH_FAILED',
      error: 'refresh_failed',
      message: 'An unexpected error occurred during refresh. Please try again.',
    });
  }
});

// ============================================================================
// Verify Token
// ============================================================================

// ============================================================================
// Logout (public endpoint – clears cookies even without a valid session)
// ============================================================================

router.post('/logout', doubleSubmitCSRF, async (req, res) => {
  try {
    let refreshToken = req.body?.refreshToken;
    if (!refreshToken) {
      refreshToken = getRefreshTokenFromRequest(req);
    }

    if (supabaseAuthClient && refreshToken) {
      try {
        await supabaseAuthClient.auth.signOut(refreshToken);
      } catch (error) {
        console.warn('[AUTH LOGOUT] Supabase signOut failed', error?.message || error);
      }
    }
  } finally {
    clearAuthCookies(req, res);
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
});

// ============================================================================
// Protected routes (require valid access token)
// ============================================================================

router.use(authenticate);

router.get('/verify', async (req, res) => {
  res.json({
    valid: true,
    user: req.user,
    memberships: req.user?.memberships || [],
    activeOrgId: req.activeOrgId || req.user?.organizationId || null,
  });
});

router.get('/session', async (req, res) => {
  res.json({
    user: req.user,
    memberships: req.user?.memberships || [],
    organizationIds: req.user?.organizationIds || [],
    activeOrgId: req.activeOrgId || req.user?.organizationId || null,
  });
});

// ============================================================================
// Get Current User
// ============================================================================

router.get('/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        code: 'NOT_AUTHENTICATED',
        error: 'not_authenticated',
        message: 'You must be signed in to access this resource.',
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
        code: 'USER_NOT_FOUND',
        error: 'user_not_found',
        message: 'User profile was not found',
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
      code: 'USER_LOOKUP_FAILED',
      error: 'internal_server_error',
      message: 'Unable to load user profile',
    });
  }
});

export default router;
