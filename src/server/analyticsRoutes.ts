import express from 'express';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool(); // Ensure DATABASE_URL is set in the environment

// Endpoint to fetch course engagement data
router.get('/api/analytics/course-engagement', async (_: express.Request, res: express.Response) => {
  try {
    const result = await pool.query(
      `SELECT course_id, AVG(avg_progress) AS avg_progress, COUNT(active_users) AS active_users
       FROM course_engagement
       GROUP BY course_id`
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching course engagement data:', error);
    res.status(500).json({ error: 'Failed to fetch course engagement data' });
  }
});

export default router;