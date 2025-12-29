import express from 'express';
import supabase from '../lib/supabaseClient.js';
import { generateTOTPSecret, getTOTPToken, verifyTOTPToken, sendMfaEmail } from '../utils/mfa.js';
import { createHttpError, withHttpError } from '../middleware/apiErrorHandler.js';

const router = express.Router();

// POST /mfa/challenge - send MFA code (email for now)
router.post('/challenge', async (req, res, next) => {
	const { email } = req.body;
	if (!email) return res.status(400).json({ error: 'Missing email' });

	try {
		if (!supabase) return next(createHttpError(503, 'supabase_not_configured', 'Supabase client not initialized'));
		const { data: user, error } = await supabase
			.from('users')
			.select('id, email, mfa_secret')
			.eq('email', email.toLowerCase())
			.single();
		if (error || !user) return res.status(404).json({ error: 'User not found' });

		let secret = user.mfa_secret;
		if (!secret) {
			const newSecret = generateTOTPSecret();
			await supabase.from('users').update({ mfa_secret: newSecret.base32 }).eq('id', user.id);
			secret = newSecret.base32;
		}

		const code = getTOTPToken(secret);
		await sendMfaEmail(user.email, code);
		res.json({ success: true });
	} catch (error) {
		return next(withHttpError(error, 500, 'mfa_challenge_failed'));
	}
});

// POST /mfa/verify - verify MFA code
router.post('/verify', async (req, res, next) => {
	const { email, code } = req.body;
	if (!email || !code) return res.status(400).json({ error: 'Missing email or code' });

	try {
		if (!supabase) return next(createHttpError(503, 'supabase_not_configured', 'Supabase client not initialized'));
		const { data: user, error } = await supabase
			.from('users')
			.select('id, mfa_secret')
			.eq('email', email.toLowerCase())
			.single();
		if (error || !user || !user.mfa_secret) return res.status(404).json({ error: 'User not found or MFA not setup' });

		const valid = verifyTOTPToken(user.mfa_secret, code);
		if (!valid) return res.status(401).json({ error: 'Invalid code' });
		res.json({ success: true });
	} catch (error) {
		return next(withHttpError(error, 500, 'mfa_verify_failed'));
	}
});

export default router;
