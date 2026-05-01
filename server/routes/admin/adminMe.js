import { withAuth } from '../../middleware/withAuth.js';

export function registerAdminMeRoutes(app) {
  // Safe, minimal admin identity endpoint that returns the canonical user shape (req.user).
  app.get('/api/admin/me', ...withAuth((req, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ ok: false, error: 'unauthenticated' });
      }
      return res.json({ ok: true, data: { user: req.user } });
    } catch (e) {
      console.error('[admin.me] unexpected error', e);
      return res.status(401).json({ ok: false, error: 'unauthenticated' });
    }
  }));
}
