import express from 'express';
import {
  createPasswordResetToken,
  findUserByEmail,
  toPublicUser,
  verifyPassword,
} from '../data/mockUsers';
import {
  issueTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  decodeRefreshToken,
} from '../utils/jwt';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireAuth } from '../middleware/authMiddleware';

// ✅ These two imports are required for the Supabase OAuth bridge + cookies
import { supabaseAuthClient } from '../supabase/supabaseServerClient';
import { attachAuthCookies, clearAuthCookies } from '../utils/authCookies';

const router = express.Router();

/**
 * ✅ Supabase OAuth bridge
 * Frontend calls POST /api/auth/supabase with:
 *   Authorization: Bearer <supabase_access_token>
 * Server verifies user in Supabase, then issues YOUR app tokens and sets cookies.
 */
router.post('/supabase', async (req, res) => {
  try {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided (header or cookie)',
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

    // 4) Set cookies so /api/auth/session (or requireAuth) will work
    //    attachAuthCookies expects a shape like:
    //    { accessToken, refreshToken, expiresAt, refreshExpiresAt }
    attachAuthCookies(req, res, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
    });

    // 5) Return user (you can also return tokens; harmless, but cookies are the key)
    return res.status(200).json({ ok: true, user: publicUser });
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

  // ✅ Optional but recommended: set cookies here too for consistency
  attachAuthCookies(req, res, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
  });

  res.json({ user: publicUser, ...tokens });
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

  // ✅ Optional: set cookies on refresh too
  attachAuthCookies(req, res, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
  });

  res.json({ user: publicUser, ...tokens });
});

router.get('/verify', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ valid: true, user: req.user });
});

router.post('/logout', (req, res) => {
  const { refreshToken } = req.body ?? {};
  revokeRefreshToken(typeof refreshToken === 'string' ? refreshToken : undefined);

  // ✅ Clear cookies so browser stops sending stale tokens
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
