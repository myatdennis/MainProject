import express from 'express';
import { supabaseAuthClient } from '../supabase/supabaseServerClient.js';
import { issueTokens } from '../utils/jwt.js';
import { attachAuthCookies } from '../utils/authCookies.js';
import { findUserByEmail, toPublicUser } from '../data/mockUsers.js';

const router = express.Router();

router.post('/supabase', async (req, res) => {
  const bodyToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken : '';
  const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const accessToken = bearerToken || bodyToken;

  if (!accessToken) {
    return res.status(401).json({ error: 'Authentication required', message: 'Missing Supabase token' });
  }

  if (!supabaseAuthClient) {
    return res.status(503).json({
      error: 'supabase_not_configured',
      message: 'Supabase authentication is not configured on this server.',
    });
  }

  const { data, error } = await supabaseAuthClient.auth.getUser(accessToken);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid Supabase token' });
  }

  const email = data.user.email;
  if (!email) {
    return res.status(400).json({ error: 'validation_failed', message: 'Supabase user is missing an email address' });
  }

  const internalUser = findUserByEmail(email);
  if (!internalUser) {
    return res.status(403).json({ error: 'forbidden', message: 'User is not authorized for this portal' });
  }

  const publicUser = toPublicUser(internalUser);

  const tokens = issueTokens(publicUser);

  attachAuthCookies(req, res, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
  });

  return res.json({ success: true, user: publicUser });
});

export default router;
