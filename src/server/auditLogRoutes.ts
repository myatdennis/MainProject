import express from 'express';

const router = express.Router();

// In-memory audit log (for demo; replace with DB in production)
const auditLog: any[] = [];

router.post('/api/audit-log', (req, res) => {
  const { action, details, timestamp } = req.body;
  if (!action || !timestamp) {
    return res.status(400).json({ error: 'Missing action or timestamp' });
  }
  auditLog.push({ action, details, timestamp, ip: req.ip });
  // In production, write to persistent storage (DB)
  res.status(201).json({ success: true });
});

// (Optional) GET endpoint for audit log (admin only)
router.get('/api/audit-log', (req, res) => {
  // Add authentication/authorization in production
  res.json({ data: auditLog });
});

export default router;
