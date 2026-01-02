import express from 'express';
import supabase, { isSupabaseConfigured } from '../lib/supabaseClient.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { createHttpError, withHttpError } from '../middleware/apiErrorHandler.js';

const router = express.Router();
router.use((req, res, next) => {
  console.log('[ADMIN COURSES] req.user:', req.user);
  next();
});

router.use(authenticate, requireAdmin);

// Health check endpoint for Supabase connectivity
router.get('/health/supabase', async (req, res, next) => {
	if (!isSupabaseConfigured() || !supabase) {
		return next(createHttpError(503, 'supabase_not_configured', 'Supabase not configured'));
	}
	try {
		const { error } = await supabase.from('courses').select('id').limit(1);
		if (error) {
			return next(createHttpError(502, 'supabase_unreachable', error.message));
		}
		return res.json({ connected: true });
	} catch (err) {
		return next(withHttpError(err, 500, 'supabase_health_failed'));
	}
});

// POST /api/admin/courses/duplicate
router.post('/duplicate', async (req, res, next) => {
	try {
		const { courseId } = req.body;
		if (!courseId) return res.status(400).json({ error: 'Missing courseId' });
		if (!supabase) return next(createHttpError(503, 'supabase_not_configured', 'Supabase client not configured'));
		// Fetch the course
		const { data: course, error } = await supabase.from('courses').select('*').eq('id', courseId).single();
		if (error || !course) return res.status(404).json({ error: 'Course not found' });
		// Duplicate with new id and title
		const newCourse = {
			...course,
			id: `course-${Date.now()}`,
			title: `${course.title} (Copy)`
		};
		delete newCourse.created_at;
		delete newCourse.updated_at;
		const { data: inserted, error: insertError } = await supabase.from('courses').insert([newCourse]);
		if (insertError) return next(createHttpError(500, 'course_duplicate_failed', insertError.message));
		if (!inserted || inserted.length === 0) return next(createHttpError(500, 'course_duplicate_failed', 'Failed to insert duplicated course'));
		res.json({ course: inserted[0] });
	} catch (err) {
		return next(withHttpError(err, 500, 'course_duplicate_failed'));
	}
});

export default router;
