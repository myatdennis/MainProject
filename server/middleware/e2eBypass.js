import { finalizeUser } from '../lib/finalizeUser.js';

const isDev = process.env.NODE_ENV !== 'production';

export function e2eBypass(req, res, next) {
  const isE2E =
    String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true' &&
    String(process.env.NODE_ENV || '').toLowerCase() !== 'production';

  try {
    const bypassHeader = typeof req.headers['x-e2e-bypass'] !== 'undefined' ? String(req.headers['x-e2e-bypass']) : null;
    // Debug: log E2E bypass decision inputs
    if (isDev) {
      console.log('[E2E MODE]', process.env.E2E_TEST_MODE);
      console.info('[e2eBypass] invoked', { isE2E, nodeEnv: process.env.NODE_ENV, bypassHeader: Boolean(bypassHeader) });
    }
    const normalizedBypass = String(bypassHeader || '').trim().toLowerCase();
    if (isE2E && ['1', 'true', 'yes', 'on'].includes(normalizedBypass)) {
      const headerOrg =
        req.headers['x-organization-id'] ||
        req.headers['x-org-id'] ||
        req.query?.organizationId ||
        req.query?.orgId ||
        'demo-sandbox-org';
      const synth = {
        id: '00000000-0000-0000-0000-000000000001',
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'mya+e2e@the-huddle.co',
        role: 'platform_admin',
        platformRole: 'platform_admin',
        isPlatformAdmin: true,
        organizationIds: [headerOrg],
        activeOrgId: headerOrg,
        organizationId: headerOrg,
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
        req.organizationId = req.organizationId || req.user.organizationId || null;
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
