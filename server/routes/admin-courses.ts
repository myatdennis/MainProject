import express from 'express';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.ts';

const router = express.Router();

// Health check endpoint for Supabase connectivity
router.get('/health/supabase', async (req, res) => {
  if (!isSupabaseConfigured() || !supabase) {
    return res.status(500).json({ connected: false, error: 'Supabase not configured' });
  }
  try {
    // Try a simple query to check connectivity
    const { error } = await supabase.from('courses').select('id').limit(1);
    if (error) {
      return res.status(500).json({ connected: false, error: error.message });
    }
    return res.json({ connected: true });
  } catch (err) {
    return res.status(500).json({ connected: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/admin/courses/duplicate
router.post('/duplicate', async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ error: 'Missing courseId' });
    if (!supabase) return res.status(500).json({ error: 'Supabase client not configured' });
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
  const { data: inserted, error: insertError } = await supabase.from('courses').insert([newCourse]) as { data: any[] | null, error: any };
    if (insertError) return res.status(500).json({ error: insertError.message });
    if (!inserted || inserted.length === 0) return res.status(500).json({ error: 'Failed to insert duplicated course' });
    res.json({ course: inserted[0] });
  } catch (err) {
    res.status(500).json({ error: 'Duplicate failed', details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
