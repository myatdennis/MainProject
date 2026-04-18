import { describe, it, expect } from 'vitest';

const importCors = async () => {
  // Clear module cache to respect environment variable changes between tests.
  const modPath = '/Users/myadennis/Downloads/MainProject/server/middleware/cors.js';
  Object.keys(require.cache || {}).forEach((k) => {
    if (k === modPath || k.endsWith('/server/middleware/cors.js')) delete require.cache[k];
  });
  // Dynamic import ensures process.env changes are picked up.
  const mod = await import(modPath);
  return mod;
};

describe('CORS allowed headers gating', () => {
  it('does NOT include x-e2e-bypass by default', async () => {
    delete process.env.E2E_TEST_MODE;
    const mod = await importCors();
    const headers = mod.corsAllowedHeaders || [];
  const lower = headers.map(String).map((h: any) => String(h).toLowerCase());
    expect(lower).not.toContain('x-e2e-bypass');
  });

  it('includes x-e2e-bypass when E2E_TEST_MODE=true and not production', async () => {
    process.env.E2E_TEST_MODE = 'true';
    process.env.NODE_ENV = 'development';
    const mod = await importCors();
    const headers = mod.corsAllowedHeaders || [];
  const lower = headers.map(String).map((h: any) => String(h).toLowerCase());
    expect(lower).toContain('x-e2e-bypass');
    delete process.env.E2E_TEST_MODE;
  });
});
