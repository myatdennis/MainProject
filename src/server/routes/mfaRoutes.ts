import express from 'express';
import { saveMfaChallenge, verifyMfaChallenge, findUserByEmail } from '../data/mockUsers.js';

const router = express.Router();

router.post('/challenge', (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }
  const userExists = !!findUserByEmail(String(email));
  if (!userExists) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  const code = (Math.floor(Math.random() * 900000) + 100000).toString();
  saveMfaChallenge(String(email), code);
  res.json({ success: true, channel: 'email' });
});

router.post('/verify', (req, res) => {
  const { email, code } = req.body ?? {};
  if (!email || !code) {
    return res.status(400).json({ success: false, error: 'Email and code are required' });
  }
  const valid = verifyMfaChallenge(String(email), String(code));
  res.json({ success: valid });
});

export default router;
