/**
 * Authentication Routes
 * Login, register, token refresh, and logout endpoints
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { generateTokens, verifyRefreshToken, isJwtSecretConfigured, extractTokenFromHeader } from '../utils/jwt.js';
import {
  authenticate,
  authLimiter,
  normalizeEmail,
  isCanonicalAdminEmail,
  resolveUserRole,
  mapMembershipRows,
  buildAuthContext,
} from '../middleware/auth.js';
import supabase, { supabaseAuthClient } from '../lib/supabaseClient.js';
<<<<<<< HEAD
import getUserMemberships from '../utils/memberships.js';
import {
  setAuthCookies,
  clearAuthCookies,
  getRefreshTokenFromRequest,
  setActiveOrgCookie,
  getAccessTokenFromRequest,
} from '../utils/authCookies.js';
import { doubleSubmitCSRF, setCSRFToken } from '../middleware/csrf.js';
=======
import { clearAuthCookies } from '../utils/authCookies.js';
>>>>>>> 43edcac (fadfdsa)
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

const devLoginDiagnosticsEnabled = (process.env.NODE_ENV || '').toLowerCase() !== 'production';
const isE2ETestMode = e2eTestMode;
const isDemoModeExplicit = demoModeExplicit || allowDemoExplicit;
const allowLegacyDemoUsers = allowLegacyDemoUsersFlag || isE2ETestMode;

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

const refreshSessionFromToken = async (req, refreshToken) => {
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

  if (!refreshToken) {
    return {
      ok: false,
      status: 401,
      error: 'missing_refresh_token',
      message: 'Refresh token is required',
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
<<<<<<< HEAD
    setAuthCookies(req, res, tokens);
    setCSRFToken(req, res, () => {});
    setCSRFToken(req, res, () => {});
=======
>>>>>>> 43edcac (fadfdsa)
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

  const membershipRows = await getUserMemberships(data.user.id, { logPrefix: '[auth-refresh]' });
  const userPayload = buildUserPayloadFromSupabase(data.user, membershipRows);
  const tokens = buildTokenResponseFromSession(data.session);

<<<<<<< HEAD
  setAuthCookies(req, res, tokens);
  setCSRFToken(req, res, () => {});
  setCSRFToken(req, res, () => {});

=======
>>>>>>> 43edcac (fadfdsa)
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
    const supabaseUrlHost = (() => {
      try {
        const rawUrl = process.env.SUPABASE_URL || '';
        if (!rawUrl) return null;
        return new URL(rawUrl).host || null;
      } catch {
        return null;
      }
    })();
    const passwordLength = typeof password === 'string' ? password.length : null;
    const hasLeadingOrTrailingWhitespace =
      typeof password === 'string' ? password.trim() !== password : null;
    const containsNewline = typeof password === 'string' ? /\r|\n/.test(password) : null;
    const contentType = req.headers['content-type'] || null;
    const originHeader = req.headers?.origin || null;
    const logDevDiagnostics = (extra = {}) => {
      if (!devLoginDiagnosticsEnabled) return;
      console.debug('[AUTH LOGIN][dev-diagnostics]', {
        email: email || null,
        passwordLength,
        hasLeadingOrTrailingWhitespace,
        containsNewline,
        contentType,
        supabaseUrlHost,
        originHeader,
        ...extra,
      });
    };
    logDevDiagnostics({ signInWithPasswordAttempted: false, supabaseErrorStatus: null, supabaseErrorCode: null });
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    if (!email || !password) {
      logDevDiagnostics({ signInWithPasswordAttempted: false, supabaseErrorStatus: null, supabaseErrorCode: null });
      const payload = {
        code: 'MISSING_CREDENTIALS',
        error: 'missing_credentials',
        message: 'Email and password are required',
      };
      if (devLoginDiagnosticsEnabled) {
        console.info('[AUTH LOGIN][dev]', {
          email: email || null,
          reason: 'missing_credentials',
        });
      }
      return res.status(400).json(payload);
    }
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('[DEBUG_AUTH] login input', { email, ip });
    }
    const normalizedEmail = normalizeEmail(email);
    const diagnostics = devLoginDiagnosticsEnabled
      ? {
          email: normalizedEmail,
<<<<<<< HEAD
          userId: null,
          membershipCount: null,
          membershipRoles: [],
        }
      : null;
    const emitDevLoginLog = (reason) => {
      if (!diagnostics) {
        return;
      }
      console.info('[AUTH LOGIN][dev]', {
        email: diagnostics.email,
        userId: diagnostics.userId,
        membershipCount: diagnostics.membershipCount,
        membershipRoles: diagnostics.membershipRoles,
        reason,
      });
    };
    const sendInvalidCredentials = () => {
      emitDevLoginLog('invalid_password');
      return res.status(401).json({
        error: 'Invalid login credentials',
      });
    };
    let userRecord = null;
    if (supabase) {
      try {
        const { data: users, error: queryError } = await supabase
          .from('users')
          .select('*')
          .eq('email', normalizedEmail)
          .limit(1);
        if (queryError) {
          if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Failed to load profile row', { queryError });
          console.warn('[AUTH LOGIN DB ERROR]', {
=======
          role: resolvedRole,
          organizationId: demoUser.organizationId,
        });
        if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Demo tokens issued');
        return res.json({
          user: {
            id: demoUser.id,
>>>>>>> 43edcac (fadfdsa)
            email: normalizedEmail,
            ip,
            error: queryError?.message,
            at: 'supabase.from(users).select',
          });
        } else if (users && users.length > 0) {
          userRecord = users[0];
        }
      } catch (profileError) {
        if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Profile lookup error', { profileError });
        console.error('[AUTH LOGIN PROFILE ERROR]', {
          email: normalizedEmail,
          ip,
          error: profileError instanceof Error ? profileError.message : profileError,
          at: 'profile lookup',
        });
      }
    }
    if (diagnostics) {
      diagnostics.userId = userRecord?.id || null;
      if (userRecord?.id) {
        try {
          const membershipRows = await getUserMemberships(userRecord.id, { logPrefix: '[auth-login]' });
          const membershipRoles = Array.isArray(membershipRows)
            ? Array.from(new Set(membershipRows.map((row) => row?.role || row?.organization_role || 'member').filter(Boolean)))
            : [];
          diagnostics.membershipCount = Array.isArray(membershipRows) ? membershipRows.length : 0;
          diagnostics.membershipRoles = membershipRoles;
        } catch {
          diagnostics.membershipCount = diagnostics.membershipCount ?? 0;
          diagnostics.membershipRoles = diagnostics.membershipRoles ?? [];
        }
      } else {
        diagnostics.membershipCount = diagnostics.membershipCount ?? 0;
        diagnostics.membershipRoles = diagnostics.membershipRoles ?? [];
      }
    }
    if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Attempting Supabase login', { normalizedEmail, origin, ip });
    logDevDiagnostics({ signInWithPasswordAttempted: true, supabaseErrorStatus: null, supabaseErrorCode: null });
    if (!supabase || !supabaseAuthClient) {
      if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Supabase client missing');
      const configError = buildAuthConfigError();
      logDevDiagnostics({
        signInWithPasswordAttempted: false,
        supabaseErrorStatus: configError?.status ?? null,
        supabaseErrorCode: configError?.code || null,
      });
      return res.status(configError.status).json(configError);
    }
    const { data, error: authError } = await supabaseAuthClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (authError || !data?.user || !data.session) {
      logDevDiagnostics({
        signInWithPasswordAttempted: true,
        supabaseErrorStatus: typeof authError?.status === 'number' ? authError.status : null,
        supabaseErrorCode: authError?.code || authError?.name || null,
      });
      const detailMessage = authError?.message || 'unknown error';
      // Safe log for failed login (mask password)
      console.warn('[AUTH LOGIN FAILURE]', {
        email: normalizedEmail,
        ip,
        error: detailMessage,
        at: 'supabaseAuthClient.auth.signInWithPassword',
      });
      if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Supabase auth failed', { detailMessage });
      return sendInvalidCredentials();
    }
    if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Supabase auth success', { userId: data.user.id });
    logDevDiagnostics({ signInWithPasswordAttempted: true, supabaseErrorStatus: null, supabaseErrorCode: null });
    if (userRecord && userRecord.is_active === false) {
      if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Profile marked inactive');
      console.warn('[AUTH LOGIN INACTIVE]', {
        email: normalizedEmail,
        ip,
        at: 'userRecord.is_active === false',
      });
      const payload = {
        code: 'ACCOUNT_DISABLED',
        error: 'account_disabled',
        message: 'Your account has been disabled',
      };
      emitDevLoginLog('invalid_password');
      return res.status(403).json(payload);
    }
    const supabaseUser = data.user;
    const membershipRows = await getUserMemberships(supabaseUser.id, { logPrefix: '[auth-login]' });
    if (diagnostics) {
      diagnostics.userId = supabaseUser.id;
      diagnostics.membershipCount = Array.isArray(membershipRows) ? membershipRows.length : 0;
      diagnostics.membershipRoles = Array.isArray(membershipRows)
        ? Array.from(new Set(membershipRows.map((row) => row?.role || row?.organization_role || 'member').filter(Boolean)))
        : [];
    }
    const userPayload = buildUserPayloadFromSupabase(supabaseUser, membershipRows);
    const tokens = buildTokenResponseFromSession(data.session);
<<<<<<< HEAD
    setAuthCookies(req, res, tokens);
    setCSRFToken(req, res, () => {});
    if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
      const setCookieHeader = res.getHeader('set-cookie');
      console.info('[AUTH LOGIN][dev] set-cookie (supabase)', {
        hasSetCookie: Boolean(setCookieHeader),
        cookieCount: Array.isArray(setCookieHeader) ? setCookieHeader.length : setCookieHeader ? 1 : 0,
      });
    }
    if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Tokens issued, cookies set', { userId: userPayload.userId });
    emitDevLoginLog('success');
=======
    if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] Tokens issued', { userId: userPayload.userId });
>>>>>>> 43edcac (fadfdsa)
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
    const payload = {
      code: 'LOGIN_FAILED',
      error: 'login_failed',
      message: 'An unexpected error occurred during login. Please try again.',
    };
    logDevDiagnostics({
      signInWithPasswordAttempted: true,
      supabaseErrorStatus: typeof error?.status === 'number' ? error.status : null,
      supabaseErrorCode: error instanceof Error ? error.name : null,
    });
    return res.status(500).json(payload);
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

      const membershipRows = await getUserMemberships(sessionData.user.id, { logPrefix: '[auth-register]' });
      const userPayload = buildUserPayloadFromSupabase(sessionData.user, membershipRows);
      const tokens = buildTokenResponseFromSession(sessionData.session);
<<<<<<< HEAD

  setAuthCookies(req, res, tokens);
=======
>>>>>>> 43edcac (fadfdsa)
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
    const refreshTokenInput = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
    const refreshToken = refreshTokenInput || null;
    if (!refreshToken) {
      if (process.env.DEBUG_AUTH === 'true') console.log('[DEBUG_AUTH] No refresh_token, rejecting');
      console.warn('[AUTH REFRESH FAILURE] Missing refresh token payload', {
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        at: 'refresh_request_validation',
      });
      return res.status(401).json({
        code: 'MISSING_REFRESH_TOKEN',
        error: 'missing_refresh_token',
        message: 'Refresh token is required',
      });
    }
    const result = await refreshSessionFromToken(req, refreshToken);
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
        at: 'refreshSessionFromToken',
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

router.post('/logout', async (req, res) => {
  try {
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null;

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

router.get('/session', async (req, res) => {
  const requestId = req.requestId || req.headers['x-request-id'] || req.headers['x-amzn-trace-id'] || null;
  const bearerToken = extractTokenFromHeader(req.headers?.authorization);
  const cookieToken = getAccessTokenFromRequest(req);
  const mode = bearerToken ? 'bearer' : cookieToken ? 'cookie' : 'none';
  const logBase = {
    event: 'auth_session',
    mode,
    requestId,
    hasBearer: Boolean(bearerToken),
    hasCookie: Boolean(cookieToken),
    origin: req.headers?.origin || null,
  };

  if (mode === 'none') {
    console.info('[auth/session] no session token', logBase);
    return res.status(401).json({
      error: 'not_authenticated',
      message: 'No authenticated session detected.',
      authenticated: false,
      mode,
    });
  }

  try {
    const context = await buildAuthContext(req, { optional: false });
    const user = context?.user || null;
    if (!user) {
      console.warn('[auth/session] context missing user', { ...logBase, outcome: 'no_user' });
      return res.status(401).json({
        error: 'not_authenticated',
        message: 'Invalid or expired session.',
        authenticated: false,
        mode,
      });
    }

    const responsePayload = {
      user,
      memberships: Array.isArray(user.memberships) ? user.memberships : [],
      organizationIds: Array.isArray(user.organizationIds) ? user.organizationIds : [],
      activeOrgId: context.activeOrgId || user.organizationId || null,
      role: user.role || null,
      authenticated: true,
      mode,
    };

    console.info('[auth/session] success', {
      ...logBase,
      outcome: 'ok',
      userId: user.id || null,
      orgCount: responsePayload.organizationIds.length,
    });

    return res.json(responsePayload);
  } catch (error) {
    let status = 500;
    let code = 'session_error';
    let message = 'Unable to verify session.';
    const errorMessage = error?.message || 'unknown_error';

    if (errorMessage === 'missing_token') {
      status = 401;
      code = 'not_authenticated';
      message = 'No authenticated session detected.';
    } else if (errorMessage === 'invalid_token') {
      status = 401;
      code = 'invalid_token';
      message = 'Invalid or expired session token.';
    } else if (errorMessage === 'supabase_not_configured') {
      status = 503;
      code = 'auth_unavailable';
      message = 'Authentication service unavailable.';
    }

    console.warn('[auth/session] failure', {
      ...logBase,
      outcome: 'error',
      status,
      code,
      error: errorMessage,
    });

    return res.status(status).json({
      error: code,
      message,
      authenticated: false,
      mode,
    });
  }
});

/**
 * Manual verification (local):
 * curl -H "Authorization: Bearer <ACCESS>" http://localhost:8888/api/auth/session
 * curl --cookie "access_token=<TOKEN>" http://localhost:8888/api/auth/session
 */

// ============================================================================
// Protected routes (require valid access token)
// ============================================================================

router.use(authenticate);

router.patch('/active-org', (req, res) => {
  const requested =
    typeof req.body?.orgId === 'string' && req.body.orgId.trim().length > 0
      ? req.body.orgId.trim()
      : null;

  if (!requested) {
    setActiveOrgCookie(req, res, '');
    req.activeOrgId = null;
    return res.json({ activeOrgId: null });
  }

  const memberships = req.orgMemberships;
  const hasMembership = memberships instanceof Map ? memberships.has(requested) : false;
  if (!hasMembership) {
    return res.status(403).json({
      error: 'org_access_denied',
      message: 'You do not have access to that organization.',
    });
  }

  setActiveOrgCookie(req, res, requested);
  req.activeOrgId = requested;
  res.json({ activeOrgId: requested });
});

router.get('/verify', async (req, res) => {
  res.json({
    valid: true,
    user: req.user,
    memberships: req.user?.memberships || [],
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
