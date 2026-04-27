import { request } from '@playwright/test';

/**
 * Create a Playwright API request context pre-populated with E2E headers
 * so tests using request.newContext() don't need to duplicate header setup.
 */
export async function createE2ERequestContext(opts: { baseURL?: string; role?: string } = {}) {
  const { baseURL = 'http://127.0.0.1:8888', role = 'learner' } = opts;

  return await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      'x-e2e-bypass': 'true',
      'x-user-role': role,
      'x-org-id': 'demo-sandbox-org',
    },
  });
}

export default createE2ERequestContext;
