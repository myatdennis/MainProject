import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetStoredAccessToken = vi.fn();
const mockGetRefreshToken = vi.fn();
const mockSetAccessToken = vi.fn();
const mockSetRefreshToken = vi.fn();
const mockGetSupabase = vi.fn();
const mockResolveOrgHeaderForRequest = vi.fn();

vi.mock('../secureStorage', () => ({
  getAccessToken: mockGetStoredAccessToken,
  getRefreshToken: mockGetRefreshToken,
  setAccessToken: mockSetAccessToken,
  setRefreshToken: mockSetRefreshToken,
}));

vi.mock('../supabaseClient', () => ({
  getSupabase: mockGetSupabase,
}));

vi.mock('../orgContext', () => ({
  ORG_HEADER_NAME: 'X-Org-Id',
  LEGACY_ORG_HEADER_NAME: 'X-Organization-Id',
  resolveOrgHeaderForRequest: mockResolveOrgHeaderForRequest,
}));

const originalFetch = globalThis.fetch;
const fetchSpy = vi.fn();
(globalThis as any).fetch = fetchSpy;

const headersToObject = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }
  return { ...(headers as Record<string, string>) };
};

const getHeaderValue = (headers: Record<string, string>, key: string): string | undefined => {
  const normalized = key.toLowerCase();
  const entry = Object.entries(headers).find(([candidate]) => candidate.toLowerCase() === normalized);
  return entry?.[1];
};

describe('authorizedFetch E2E bypass invariants', () => {
  beforeEach(() => {
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    mockGetStoredAccessToken.mockReset();
    mockGetStoredAccessToken.mockReturnValue('stored-access-token');
    mockGetRefreshToken.mockReset();
    mockSetAccessToken.mockReset();
    mockSetRefreshToken.mockReset();
    mockGetSupabase.mockReset();
    mockGetSupabase.mockReturnValue(null);
    mockResolveOrgHeaderForRequest.mockReset();
    mockResolveOrgHeaderForRequest.mockReturnValue(null);
    (window as any).__E2E_BYPASS = true;
  });

  afterEach(() => {
    delete (window as any).__E2E_BYPASS;
  });

  afterAll(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('strips Authorization and preserves explicit bypass role headers', async () => {
    const { default: authorizedFetch } = await import('../authorizedFetch');

    await authorizedFetch('/api/admin/me', {
      headers: {
        Authorization: 'Bearer should-be-removed',
        'X-User-Role': 'admin',
      },
    });

    const [, options] = fetchSpy.mock.calls[0];
    const headers = headersToObject(options?.headers as HeadersInit);
    expect(getHeaderValue(headers, 'Authorization')).toBeUndefined();
    expect(getHeaderValue(headers, 'X-E2E-Bypass')).toBe('true');
    expect(getHeaderValue(headers, 'X-User-Role')).toBe('admin');
  });

  it('strips Authorization and sets learner bypass headers for learner paths', async () => {
    const { default: authorizedFetch } = await import('../authorizedFetch');

    await authorizedFetch('/api/client/courses', {
      headers: { Authorization: 'Bearer should-be-removed' },
    });

    const [, options] = fetchSpy.mock.calls[0];
    const headers = headersToObject(options?.headers as HeadersInit);
    expect(getHeaderValue(headers, 'Authorization')).toBeUndefined();
    expect(getHeaderValue(headers, 'X-E2E-Bypass')).toBe('true');
    expect(getHeaderValue(headers, 'X-User-Role')).toBe('learner');
  });

  it('rewrites legacy Supabase functions auth URLs back to the canonical API path', async () => {
    const { default: authorizedFetch } = await import('../authorizedFetch');

    await authorizedFetch('https://example.supabase.co/functions/v1/api/auth/login', {
      method: 'POST',
      headers: { Authorization: 'Bearer should-be-removed' },
    });

    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).not.toContain('/functions/v1/api/auth/login');
    expect(String(url)).toContain('/api/auth/login');
  });
});
