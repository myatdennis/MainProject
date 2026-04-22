import { defineConfig } from '@playwright/test';

// Prefer running UI on Vite dev (5174) and proxy API to the E2E helper (8888)
process.env.E2E_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5174';
process.env.E2E_API_BASE_URL = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8888';
process.env.E2E_TEST_MODE = process.env.E2E_TEST_MODE || 'true';
process.env.DEV_FALLBACK = process.env.DEV_FALLBACK || 'true';

const shouldStartWebServer = process.env.E2E_SKIP_WEB_SERVER !== 'true';

export default defineConfig({
  testDir: './',
  timeout: 90_000,
  use: {
  baseURL: process.env.E2E_BASE_URL || 'http://localhost:5174',
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
    // Note: We intentionally avoid global extraHTTPHeaders here because
    // that would add the headers to cross-origin requests (fonts, CDNs)
    // and trigger CORS preflight failures. The tests use page.init scripts
    // (helpers/auth.ts) to set a same-origin cookie and monkeypatch fetch
    // to attach E2E headers only to same-origin requests.
  },
  webServer: shouldStartWebServer
    ? {
        // Start both API and Vite dev together
        command: 'node ./server/start-e2e-dev.cjs',
        cwd: process.cwd(),
        url: process.env.E2E_BASE_URL || 'http://localhost:5174',
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
