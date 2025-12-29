import express from 'express';
import supabase from '../lib/supabaseClient.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { createHttpError, withHttpError } from '../middleware/apiErrorHandler.js';

const router = express.Router();

router.use(authenticate, requireAdmin);

// POST /api/admin/users/import
router.post('/import', async (req, res, next) => {
	try {
		if (!supabase) return next(createHttpError(503, 'supabase_not_configured', 'Supabase not configured'));
		const users = req.body.users;
		if (!Array.isArray(users)) {
			return res.status(400).json({ error: 'Invalid users array' });
		}
		const results = [];
		for (const user of users) {
			// Upsert user by email
			const { error } = await supabase
				.from('users')
				.upsert([user], { onConflict: 'email' });
			if (error) {
				results.push({ email: user.email, error: error.message });
			} else {
				results.push({ email: user.email, status: 'ok' });
			}
		}
		res.json({ results });
	} catch (err) {
		return next(withHttpError(err, 500, 'admin_users_import_failed'));
	}
});

// GET /api/admin/users/export
router.get('/export', async (req, res, next) => {
	try {
		if (!supabase) return next(createHttpError(503, 'supabase_not_configured', 'Supabase not configured'));
		const { data, error } = await supabase.from('users').select('*');
		if (error) return next(createHttpError(500, 'admin_users_export_failed', error.message));
		res.json({ users: data });
	} catch (err) {
		return next(withHttpError(err, 500, 'admin_users_export_failed'));
	}
});

export default router;
