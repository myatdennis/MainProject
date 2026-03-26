import { defineConfig } from '@playwright/test';

const defaultBaseUrl = process.env.E2E_BASE_URL || 'http://localhost:8888';

export default defineConfig({
  testDir: './',
  timeout: 90_000,
  use: {
    baseURL: defaultBaseUrl,
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
    trace: 'off',
  },
  workers: process.env.CI ? 2 : 1,
});
