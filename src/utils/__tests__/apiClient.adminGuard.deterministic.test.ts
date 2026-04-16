import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
const fetchSpy = vi.fn();
(globalThis as any).fetch = fetchSpy;

beforeEach(() => {
  fetchSpy.mockReset();
  vi.unstubAllEnvs();
});

afterEach(() => {
  // restore env side-effects between tests
  vi.unstubAllEnvs();
});

afterAll(() => {
  // restore the original fetch implementation to avoid leaking into other suites
  try {
    (globalThis as any).fetch = undefined;
  } catch {
    // ignore
  }
});

describe('apiClient deterministic admin-guard', () => {
  it('throws ApiError (403) when caller supplies non-admin surface in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEV', '' as any);
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');

    // load the module fresh so env stubs take effect
    const { apiRequest, ApiError } = await import('../apiClient');

    // Ensure fetch would not be called because the guard should reject early
    fetchSpy.mockImplementation(() => {
      throw new Error('fetch should not be called when admin guard blocks the request');
    });

    await expect(apiRequest('/api/admin/courses', { surface: 'lms' as any })).rejects.toSatisfy((err) => {
      // Stable, deterministic assertion: error is ApiError with 403
      if (!(err instanceof ApiError)) return false;
      return err.status === 403 && String(err.message || '').toLowerCase().includes('administrator');
    });

    // Confirm fetch was never invoked when guard blocked the call
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
