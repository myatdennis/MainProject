import express from 'express';
import {
  createPasswordResetToken,
  findUserByEmail,
  toPublicUser,
  verifyPassword,
} from '../data/mockUsers.js';
import {
  issueTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  decodeRefreshToken,
  verifyAccessToken,
} from '../utils/jwt.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { requireAuth } from '../middleware/authMiddleware.js';

<<<<<<< HEAD
// ✅ These two imports are required for the Supabase OAuth bridge + cookies
import { supabaseAuthClient } from '../supabase/supabaseServerClient.js';
import { attachAuthCookies, clearAuthCookies } from '../utils/authCookies.js';
import {
  getActiveOrgForUser,
  listUserMemberships,
  setActiveOrgForUser,
  getOrganizationIdsForUser,
} from '../data/mockOrganizations.js';
import { findUserById } from '../data/mockUsers.js';

type SessionPayload = {
  user: ReturnType<typeof toPublicUser> & {
    activeOrgId: string | null;
    organizationIds: string[];
    platformRole: string | null;
    isPlatformAdmin: boolean;
  };
  memberships: ReturnType<typeof listUserMemberships>;
  organizationIds: string[];
  activeOrgId: string | null;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  refreshExpiresAt?: number;
};

const buildSessionPayload = (
  user: ReturnType<typeof toPublicUser>,
  overrides: Partial<Omit<SessionPayload, 'user' | 'memberships' | 'organizationIds'>> = {},
): SessionPayload => {
  const memberships = listUserMemberships(user.id);
  const organizationIds = getOrganizationIdsForUser(user.id);
  const fallbackOrg = user.organizationId ?? organizationIds[0] ?? null;
  const activeOrgId = overrides.activeOrgId ?? getActiveOrgForUser(user.id) ?? fallbackOrg;
  if (activeOrgId) {
    setActiveOrgForUser(user.id, activeOrgId);
  }
  return {
    user: {
      ...user,
      activeOrgId,
      organizationIds,
      platformRole: user.role === 'admin' ? 'platform_admin' : user.role,
      isPlatformAdmin: user.role === 'admin',
    },
    memberships,
    organizationIds,
    activeOrgId,
    ...overrides,
  };
};
=======
// Supabase OAuth bridge helpers + legacy cookie cleanup
import { supabaseAuthClient } from '../supabase/supabaseServerClient';
import { clearAuthCookies } from '../utils/authCookies';
>>>>>>> 43edcac (fadfdsa)

const router = express.Router();

/**
 * ✅ Supabase OAuth bridge
 * Frontend calls POST /api/auth/supabase with:
 *   Authorization: Bearer <supabase_access_token>
 * Server verifies user in Supabase, then issues YOUR app tokens for client-side storage.
 */
router.post('/supabase', async (req, res) => {
  try {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No bearer token provided in the Authorization header',
      });
    }

    if (!supabaseAuthClient) {
      return res.status(503).json({
        error: 'supabase_not_configured',
        message: 'Supabase authentication is not configured on the server.',
      });
    }

    // 1) Validate Supabase token -> get Supabase user
    const { data, error } = await supabaseAuthClient.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Invalid Supabase token',
      });
    }

    const email = data.user.email;
    if (!email) {
      return res.status(400).json({
        error: 'validation_failed',
        message: 'Supabase user has no email',
      });
    }

    // 2) Map Supabase user -> your internal user record
    //    (Right now your app uses mock users, so we look it up by email.)
    const user = findUserByEmail(String(email));
    if (!user) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'User not allowed',
      });
    }

    // 3) Issue YOUR app tokens
    const publicUser = toPublicUser(user);
    const tokens = issueTokens(publicUser);

    // 4) Return the tokens directly so the frontend can store them client-side
    return res.status(200).json({ ok: true, user: publicUser, ...tokens });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = findUserByEmail(String(email));
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await verifyPassword(user, String(password));
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const publicUser = toPublicUser(user);
  const tokens = issueTokens(publicUser);

<<<<<<< HEAD
  // ✅ Optional but recommended: set cookies here too for consistency
  attachAuthCookies(req, res, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
  });

  const sessionPayload = buildSessionPayload(publicUser, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
  });

  res.json(sessionPayload);
=======
  res.json({ user: publicUser, ...tokens });
>>>>>>> 43edcac (fadfdsa)
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  const payload = decodeRefreshToken(refreshToken);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const user = findUserByEmail(payload.email);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const publicUser = toPublicUser(user);
  const tokens = rotateRefreshToken(refreshToken, publicUser);
  if (!tokens) {
    return res.status(401).json({ error: 'Refresh token expired or revoked' });
  }

<<<<<<< HEAD
  // ✅ Optional: set cookies on refresh too
  attachAuthCookies(req, res, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
  });

  const sessionPayload = buildSessionPayload(publicUser, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
  });

  res.json(sessionPayload);
});

router.get('/session', (req, res) => {
  const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!token) {
    return res.status(401).json({
      error: 'not_authenticated',
      message: 'Provide an Authorization header with a Bearer token.',
    });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'invalid_token',
      message: 'Access token is invalid or expired.',
    });
  }

  const internalUser = findUserById(payload.userId) || findUserByEmail(payload.email);
  if (!internalUser) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  const sessionPayload = buildSessionPayload(toPublicUser(internalUser));
  if (header) {
    res.setHeader('Authorization', header);
  }
  return res.json(sessionPayload);
});

router.patch('/active-org', requireAuth, (req: AuthenticatedRequest, res) => {
  const orgId =
    typeof req.body?.orgId === 'string'
      ? req.body.orgId
      : typeof req.body?.organizationId === 'string'
      ? req.body.organizationId
      : null;
  if (!orgId) {
    return res.status(400).json({
      error: 'org_required',
      message: 'Provide orgId or organizationId in the request body.',
    });
  }
  const updated = setActiveOrgForUser(req.user!.userId, orgId);
  if (!updated) {
    return res.status(403).json({
      error: 'org_access_denied',
      message: 'You do not have access to the requested organization.',
    });
  }
  res.json({ activeOrgId: updated });
=======
  res.json({ user: publicUser, ...tokens });
>>>>>>> 43edcac (fadfdsa)
});

router.get('/verify', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ valid: true, user: req.user });
});

router.post('/logout', (req, res) => {
  const { refreshToken } = req.body ?? {};
  revokeRefreshToken(typeof refreshToken === 'string' ? refreshToken : undefined);

  // Legacy cookie cleanup for older builds
  clearAuthCookies(req, res);

  res.json({ success: true });
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const user = findUserByEmail(String(email));
  if (!user) {
    // Do not leak which emails exist
    return res.json({ success: true });
  }
  const token = createPasswordResetToken(user.id);
  res.json({ success: true, resetToken: token });
});

export default router;
