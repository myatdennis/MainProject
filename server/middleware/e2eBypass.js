export function e2eBypass(req, res, next) {
  const isE2E =
    String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true' &&
    String(process.env.NODE_ENV || '').toLowerCase() !== 'production';

  try {
    const bypassHeader = typeof req.headers['x-e2e-bypass'] !== 'undefined' ? String(req.headers['x-e2e-bypass']) : null;
    // Debug: log E2E bypass decision inputs
    console.info('[e2eBypass] invoked', { isE2E, nodeEnv: process.env.NODE_ENV, bypassHeader });
    if (isE2E && bypassHeader === '1') {
      req.user = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'mya+e2e@the-huddle.co',
        role: 'platform_admin',
        platformRole: 'platform_admin',
        isPlatformAdmin: true,
        e2eSynthesized: true,
      };
      console.warn('[E2E BYPASS ACTIVE - SAFE MODE]');
      return next();
    }
  } catch (e) {
    try { console.warn('[e2eBypass] middleware_error', e?.message || e); } catch (_) {}
  }
  return next();
}
