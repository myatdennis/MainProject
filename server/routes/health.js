import express from 'express';
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    supabase: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_KEY,
  });
});

export default router;
