import { defineConfig } from '@playwright/test';

// Prefer running UI on Vite dev (5174) and proxy API to 8787
process.env.E2E_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5174';
process.env.E2E_API_BASE_URL = process.env.E2E_API_BASE_URL || 'http://localhost:8787';

export default defineConfig({
  testDir: './',
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5174',
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
  },
  webServer: {
    // Start both API and Vite dev together
    command: 'node ./server/start-e2e-dev.cjs',
    cwd: process.cwd(),
    url: process.env.E2E_BASE_URL || 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
