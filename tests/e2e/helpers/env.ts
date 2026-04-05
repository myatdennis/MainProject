import type { APIRequestContext } from '@playwright/test';

export const DEFAULT_FRONTEND_BASE = 'http://localhost:5174';
export const DEFAULT_API_BASE = 'http://localhost:8888';

export const getFrontendBaseUrl = () => process.env.E2E_BASE_URL || DEFAULT_FRONTEND_BASE;
export const getApiBaseUrl = () => process.env.E2E_API_BASE_URL || DEFAULT_API_BASE;

export const waitForOk = async (
  request: APIRequestContext,
  url: string,
  timeoutMs = 30_000,
  intervalMs = 500,
) => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await request.get(url, { failOnStatusCode: false });
      if (res.status() >= 200 && res.status() < 500) {
        return;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error(`Timeout waiting for ${url}`);
};
