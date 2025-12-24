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

const router = express.Router();

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

  res.json({ user: publicUser, ...tokens });
});

router.get('/verify', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ valid: true, user: req.user });
});

router.post('/logout', (req, res) => {
  const { refreshToken } = req.body ?? {};
  revokeRefreshToken(typeof refreshToken === 'string' ? refreshToken : undefined);
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
