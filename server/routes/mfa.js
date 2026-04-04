import express from 'express';
import rateLimit from 'express-rate-limit';
import supabase from '../lib/supabaseClient.js';
import { generateTOTPSecret, getTOTPToken, verifyTOTPToken, sendMfaEmail } from '../utils/mfa.js';
import { createHttpError, withHttpError } from '../middleware/apiErrorHandler.js';

const router = express.Router();
const MFA_GENERIC_CHALLENGE_RESPONSE = {
	ok: true,
	data: { challengeAccepted: true },
	code: 'mfa_challenge_accepted',
	message: 'If the account is eligible, a verification code will be delivered.',
};
const MFA_GENERIC_VERIFY_FAILURE = {
	ok: false,
	data: null,
	code: 'mfa_verification_failed',
	message: 'The verification code is invalid or has expired.',
};

const mfaRateLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	handler: (_req, res) => {
		res.status(429).json({
			ok: false,
			data: null,
			code: 'rate_limited',
			message: 'Too many MFA requests. Please wait and try again.',
		});
	},
});

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const loadUserProfileByEmail = async (email) => {
	const { data, error } = await supabase
		.from('user_profiles')
		.select('id, email, mfa_secret')
		.eq('email', normalizeEmail(email))
		.limit(1);
	if (error) {
		throw error;
	}
	return Array.isArray(data) && data.length > 0 ? data[0] : null;
};

// POST /mfa/challenge - send MFA code (email for now)
router.post('/challenge', mfaRateLimiter, async (req, res, next) => {
	const { email } = req.body;
	if (!email) {
		return res.status(400).json({
			ok: false,
			data: null,
			code: 'missing_email',
			message: 'Email is required.',
		});
	}

	try {
		if (!supabase) return next(createHttpError(503, 'supabase_not_configured', 'Supabase client not initialized'));
		const user = await loadUserProfileByEmail(email);
		if (!user?.id || !user?.email) {
			return res.status(200).json(MFA_GENERIC_CHALLENGE_RESPONSE);
		}

		let secret = user.mfa_secret;
		if (!secret) {
			const newSecret = generateTOTPSecret();
			const { error: updateError } = await supabase
				.from('user_profiles')
				.update({ mfa_secret: newSecret.base32 })
				.eq('id', user.id);
			if (updateError) {
				throw updateError;
			}
			secret = newSecret.base32;
		}

		const code = getTOTPToken(secret);
		await sendMfaEmail(user.email, code);
		res.status(200).json(MFA_GENERIC_CHALLENGE_RESPONSE);
	} catch (error) {
		return next(withHttpError(error, 500, 'mfa_challenge_failed'));
	}
});

// POST /mfa/verify - verify MFA code
router.post('/verify', mfaRateLimiter, async (req, res, next) => {
	const { email, code } = req.body;
	if (!email || !code) {
		return res.status(400).json({
			ok: false,
			data: null,
			code: 'missing_mfa_fields',
			message: 'Email and code are required.',
		});
	}

	try {
		if (!supabase) return next(createHttpError(503, 'supabase_not_configured', 'Supabase client not initialized'));
		const user = await loadUserProfileByEmail(email);
		if (!user?.mfa_secret) {
			return res.status(401).json(MFA_GENERIC_VERIFY_FAILURE);
		}

		const valid = verifyTOTPToken(user.mfa_secret, code);
		if (!valid) return res.status(401).json(MFA_GENERIC_VERIFY_FAILURE);
		res.json({
			ok: true,
			data: { verified: true, userId: user.id },
			code: 'mfa_verified',
			message: 'MFA verification successful.',
		});
	} catch (error) {
		return next(withHttpError(error, 500, 'mfa_verify_failed'));
	}
});

export default router;
