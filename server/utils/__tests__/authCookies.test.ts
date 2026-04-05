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
  it('uses local-safe defaults on localhost in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('COOKIE_DOMAIN', '');
    vi.stubEnv('COOKIE_SAMESITE', '');
    vi.stubEnv('COOKIE_SECURE', '');

    const { getCookieOptions, describeCookiePolicy } = await loadModule();
  const options = getCookieOptions({ headers: { host: 'localhost:3000' }, hostname: 'localhost' } as any) as any;

    expect(options.sameSite).toBe('lax');
    expect(options.secure).toBe(false);
    expect(options.domain).toBeUndefined();
    expect(describeCookiePolicy().domain).toBe('.the-huddle.co');
  });

  it('uses cross-site secure cookies on the-huddle host even when NODE_ENV is development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('COOKIE_DOMAIN', '');
    vi.stubEnv('COOKIE_SAMESITE', '');
    vi.stubEnv('COOKIE_SECURE', '');

    const { getCookieOptions } = await loadModule();
    const options = getCookieOptions({ headers: { host: 'the-huddle.co' }, hostname: 'the-huddle.co' } as any) as any;

    expect(options.sameSite).toBe('none');
    expect(options.secure).toBe(true);
    expect(options.domain).toBe('.the-huddle.co');
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

  it('clears auth cookies with maxAge=0 and expires in the past', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('COOKIE_DOMAIN', '');
    vi.stubEnv('COOKIE_SAMESITE', '');
    vi.stubEnv('COOKIE_SECURE', '');

    const { clearAuthCookies } = await loadModule();
    const cookieCalls: Array<{ name: string; value: string; options: Record<string, any> }> = [];
    const res = {
      cookie: (name: string, value: string, options: Record<string, any>) => {
        cookieCalls.push({ name, value, options });
      },
    } as any;

    clearAuthCookies({ headers: { host: 'localhost:3000' }, hostname: 'localhost' } as any, res);

    expect(cookieCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of cookieCalls) {
      expect(call.value).toBe('');
      expect(call.options.maxAge).toBe(0);
      expect(new Date(call.options.expires).getTime()).toBeLessThanOrEqual(Date.now());
    }
  });
});
