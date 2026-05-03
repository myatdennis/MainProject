import { withAuth } from '../../middleware/withAuth.js';
import { getEffectiveUser } from '../../utils/getEffectiveUser.js';

const isDev = process.env.NODE_ENV !== 'production';

export function registerAdminMeRoutes(app) {
  // Safe, minimal admin identity endpoint that returns the canonical user shape (req.user).
  app.get('/api/admin/me', ...withAuth((req, res) => {
    const user = getEffectiveUser(req);
    if (isDev) {
      console.log('[ADMIN ME ENTRY]', {
        hasUser: !!user,
        userId: user?.id || user?.userId || null,
        orgId: req.organizationId,
        activeOrgId: req.activeOrgId,
      });
    }

    try {
      if (!user?.id && !user?.userId) {
        return res.status(401).json({ ok: false, error: 'unauthenticated' });
      }
      return res.json({ ok: true, data: { user: req.user } });
    } catch (e) {
      console.error('[admin.me] unexpected error', e);
      return res.status(401).json({ ok: false, error: 'unauthenticated' });
    }
  }));
}
