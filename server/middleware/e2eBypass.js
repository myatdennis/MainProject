import { finalizeUser } from '../lib/finalizeUser.js';

export function e2eBypass(req, res, next) {
  const isE2E =
    String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true' &&
    String(process.env.NODE_ENV || '').toLowerCase() !== 'production';

  try {
    const bypassHeader = typeof req.headers['x-e2e-bypass'] !== 'undefined' ? String(req.headers['x-e2e-bypass']) : null;
    // Debug: log E2E bypass decision inputs
    console.info('[e2eBypass] invoked', { isE2E, nodeEnv: process.env.NODE_ENV, bypassHeader });
    if (isE2E && bypassHeader === '1') {
      const synth = {
        id: '00000000-0000-0000-0000-000000000001',
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'mya+e2e@the-huddle.co',
        role: 'platform_admin',
        platformRole: 'platform_admin',
        isPlatformAdmin: true,
        e2eSynthesized: true,
      };
      req.e2eSynthesized = true;
      req.e2eSynthesizedUser = req.e2eSynthesizedUser || synth;
      // Canonical assignment: E2E bypass is allowed to set req.user.
      // This enforces the invariant that req.user is the single source of truth.
      if (!req.user) {
        // Finalize canonical user via central helper (freezes in non-prod)
        req.user = finalizeUser(synth);
        req.userId = req.userId || req.user.userId || req.user.id || null;
        req.activeOrgId = req.activeOrgId || req.user.organizationId || null;
        req.userPermissions = req.userPermissions || new Set(Array.isArray(req.user.permissions) ? req.user.permissions : []);
      }
      console.warn('[E2E BYPASS ACTIVE - CANONICAL USER SET]');
      return next();
    }
  } catch (e) {
    try { console.warn('[e2eBypass] middleware_error', e?.message || e); } catch (_) {}
  }
  return next();
}
