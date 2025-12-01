import express from 'express';
import supabase from '../lib/supabaseClient.js';

const router = express.Router();

// POST /api/admin/users/import
router.post('/import', async (req, res) => {
	try {
		if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
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
		const message = err instanceof Error ? err.message : String(err);
		res.status(500).json({ error: 'Import failed', details: message });
	}
});

// GET /api/admin/users/export
router.get('/export', async (req, res) => {
	try {
		if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
		const { data, error } = await supabase.from('users').select('*');
		if (error) return res.status(500).json({ error: error.message });
		res.json({ users: data });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		res.status(500).json({ error: 'Export failed', details: message });
	}
});

export default router;
