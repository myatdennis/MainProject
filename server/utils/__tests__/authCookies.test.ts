import { afterEach, describe, expect, it, vi } from 'vitest';

const loadModule = async () => {
  vi.resetModules();
  return import('../authCookies.js');
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('authCookies policy', () => {
  it('uses local-safe defaults in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('COOKIE_DOMAIN', '');
    vi.stubEnv('COOKIE_SAMESITE', '');
    vi.stubEnv('COOKIE_SECURE', '');

    const { getCookieOptions, describeCookiePolicy } = await loadModule();
  const options = getCookieOptions({ headers: { host: 'localhost:3000' }, hostname: 'localhost' } as any) as any;

    expect(options.sameSite).toBe('lax');
    expect(options.secure).toBe(false);
    expect(options.domain).toBeUndefined();
    expect(describeCookiePolicy().domain).toBeNull();
  });

  it('keeps production cross-site defaults for the-huddle domain', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('COOKIE_DOMAIN', '');
    vi.stubEnv('COOKIE_SAMESITE', '');
    vi.stubEnv('COOKIE_SECURE', '');

    const { getCookieOptions, describeCookiePolicy } = await loadModule();
  const options = getCookieOptions({ headers: { host: 'app.the-huddle.co' }, hostname: 'app.the-huddle.co' } as any) as any;

    expect(options.sameSite).toBe('none');
    expect(options.secure).toBe(true);
    expect(options.domain).toBe('.the-huddle.co');
    expect(describeCookiePolicy().domain).toBe('.the-huddle.co');
  });
});
