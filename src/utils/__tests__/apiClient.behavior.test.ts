import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __setApiBaseUrlOverride } from '../../config/apiBase';
import * as sessionGate from '../../lib/sessionGate';

const mockBuildAuthHeaders = vi.fn().mockResolvedValue({});
const mockResolveSupabaseAccessToken = vi.fn().mockResolvedValue(null);
const mockClearSupabaseAuthSnapshot = vi.fn();
vi.mock('../requestContext', () => ({
  __esModule: true,
  default: mockBuildAuthHeaders,
  resolveSupabaseAccessToken: mockResolveSupabaseAccessToken,
  clearSupabaseAuthSnapshot: mockClearSupabaseAuthSnapshot,
}));

const shouldRequireSessionSpy = vi.spyOn(sessionGate, 'shouldRequireSession');
const getActiveSessionSpy = vi.spyOn(sessionGate, 'getActiveSession');

const fetchSpy = vi.fn();
(globalThis as any).fetch = fetchSpy;

const loadApiClient = async () => {
  const module = await import('../apiClient');
  return module;
};

const createResponse = (body: any, init?: ResponseInit) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

const createAbortError = () => {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Aborted', 'AbortError');
  }
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
};

describe('apiClient', () => {
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

  beforeEach(() => {
    fetchSpy.mockReset();
    mockBuildAuthHeaders.mockReset();
    mockBuildAuthHeaders.mockResolvedValue({});
    mockResolveSupabaseAccessToken.mockReset();
    mockResolveSupabaseAccessToken.mockResolvedValue(null);
    mockClearSupabaseAuthSnapshot.mockReset();
    shouldRequireSessionSpy.mockReset();
    shouldRequireSessionSpy.mockReturnValue(false);
    getActiveSessionSpy.mockReset();
    getActiveSessionSpy.mockReturnValue(null);
    debugSpy.mockClear();
    vi.unstubAllEnvs();
    __setApiBaseUrlOverride();
    (globalThis as any).window = (globalThis as any).window || { location: { origin: 'http://localhost' } };
  });

  afterEach(() => {
    vi.useRealTimers();
    if ((window as any).__API_DEBUG__) {
      delete (window as any).__API_DEBUG__;
    }
  });

  it('uses VITE_API_BASE_URL for absolute requests', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
  __setApiBaseUrlOverride('https://api.huddle.local');
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ data: [] }));

    await apiRequest('/courses');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.huddle.local/api/courses',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('falls back to /api proxy in dev when base URL missing', async () => {
  vi.stubEnv('MODE', 'development');
  vi.stubEnv('DEV', true as any);
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ data: [] }));

    await apiRequest('/courses');

  expect(fetchSpy).toHaveBeenCalledWith('http://localhost:8888/api/courses', expect.any(Object));
  });

  it('attaches auth headers on outgoing requests', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    mockBuildAuthHeaders.mockResolvedValue({ Authorization: 'Bearer secret', 'X-Org-Id': 'org-7' });
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ data: [] }));

    await apiRequest('/courses', {
      method: 'POST',
      body: { assignedTo: { organizationIds: ['org-7'] } },
    });

    const [, options] = fetchSpy.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret');
    expect(headers['X-Org-Id']).toBe('org-7');
    expect(headers['Content-Type']).toBe('application/json');
    expect(options?.body).toContain('assignedTo');
  });

  it('stringifies plain object bodies and sets JSON headers automatically', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ ok: true }));

    await apiRequest('/courses', {
      method: 'POST',
      body: { title: 'New Course' },
    });

    const [, options] = fetchSpy.mock.calls[0];
    expect(options?.body).toBe(JSON.stringify({ title: 'New Course' }));
    expect((options?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('passes through string bodies without double-stringifying', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ ok: true }));

    await apiRequest('/echo', { method: 'POST', body: '{"raw":"json"}' });

    const [, options] = fetchSpy.mock.calls[0];
    expect(options?.body).toBe('{"raw":"json"}');
    expect((options?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('sends FormData without forcing JSON headers', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ ok: true }));

    const formData = new FormData();
    formData.append('file', new Blob(['hello'], { type: 'text/plain' }), 'greeting.txt');
    await apiRequest('/upload', { method: 'POST', body: formData });

    const [, options] = fetchSpy.mock.calls[0];
    expect(options?.body).toBe(formData);
    const headers = options?.headers as Record<string, string>;
    expect(Object.keys(headers || {}).some((key) => key.toLowerCase() === 'content-type')).toBe(false);
  });

  it('throws ApiError with parsed message on non-2xx status', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    const { apiRequest, ApiError } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ message: 'Forbidden' }, { status: 403 }));

    await expect(apiRequest('/courses')).rejects.toMatchObject({
      status: 403,
      body: { message: 'Forbidden' },
    } satisfies Partial<InstanceType<typeof ApiError>>);
  });

  it('throws ApiError via apiRequestRaw on server errors', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    const { apiRequestRaw, ApiError } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ error: 'boom' }, { status: 500 }));

    await expect(apiRequestRaw('/fail')).rejects.toMatchObject({
      status: 500,
      body: { error: 'boom' },
    } satisfies Partial<InstanceType<typeof ApiError>>);
  });

  it('aborts when timeoutMs elapses', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        const signal = init?.signal;
        if (signal) {
          const onAbort = () => {
            signal.removeEventListener('abort', onAbort);
            reject(createAbortError());
          };
          signal.addEventListener('abort', onAbort);
        }
      });
    });

    const { ApiError } = await loadApiClient();
    const promise = apiRequest('/slow', { timeoutMs: 50 });
    let caught: unknown;
    const handledPromise = promise.catch((error) => {
      caught = error;
    });
    await vi.advanceTimersByTimeAsync(60);
    await handledPromise;
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({
      status: 0,
      message: 'Request timed out',
      body: { message: 'The request exceeded the allowed time.' },
    });
  });

  it('redacts Authorization in debug logs when enabled', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    vi.stubEnv('DEV', true as any);
    __setApiBaseUrlOverride('https://api.huddle.local');
    (window as any).__API_DEBUG__ = true;
    mockBuildAuthHeaders.mockResolvedValue({ Authorization: 'Bearer SECRET', 'X-Test': '123' });
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ data: [] }));

    await apiRequest('/courses');

    const [, payload] = debugSpy.mock.calls.find((call) => call[0] === '[apiRequest][auth-debug]') ?? [];
    expect(payload.authHeaders.Authorization).toBe('[REDACTED]');
    expect(payload.mergedHeaders.Authorization).toBe('[REDACTED]');
  });

  it('rejects privileged requests when no session is available', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    shouldRequireSessionSpy.mockReturnValue(true);
    fetchSpy.mockResolvedValueOnce(createResponse({ error: 'expired' }, { status: 401 }));
    const { apiRequest, ApiError } = await loadApiClient();

    await expect(apiRequest('/api/admin/courses')).rejects.toMatchObject({
      status: 401,
      body: { code: 'not_authenticated' },
    } satisfies Partial<InstanceType<typeof ApiError>>);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/auth/refresh');
  });

  it('includes Authorization header on protected routes when session exists', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    shouldRequireSessionSpy.mockReturnValue(true);
    getActiveSessionSpy.mockReturnValue({ id: 'user-1', role: 'admin', isPlatformAdmin: true });
    mockBuildAuthHeaders.mockResolvedValue({ Authorization: 'Bearer secure-token' });
    fetchSpy.mockResolvedValueOnce(createResponse({ ok: true }));
    const { apiRequest } = await loadApiClient();

    await apiRequest('/api/client/data');

    const [, options] = fetchSpy.mock.calls[0];
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer secure-token');
  });

  it('blocks admin routes when user lacks admin privileges', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    shouldRequireSessionSpy.mockReturnValue(true);
    getActiveSessionSpy.mockReturnValue({ id: 'user-2', role: 'member' });
    const { apiRequest, ApiError } = await loadApiClient();

    await expect(apiRequest('/api/admin/users')).rejects.toMatchObject({
      status: 403,
      body: { message: 'You need administrator access to perform this action.' },
    } satisfies Partial<InstanceType<typeof ApiError>>);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('allows privileged requests to proceed when explicitly marked anonymous', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ data: [] }));

    await apiRequest('/api/admin/courses', { allowAnonymous: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('always includes credentials for fetch requests', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ data: [] }));

    await apiRequest('/courses');

    const [, options] = fetchSpy.mock.calls[0];
    expect(options).toMatchObject({ credentials: 'include' });
  });

  it('attempts a refresh when requiresAuth and no active session, then proceeds', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    shouldRequireSessionSpy.mockReturnValue(true);
    getActiveSessionSpy
      .mockReturnValueOnce(null) // prepareRequest
      .mockReturnValueOnce(null) // sendRequest initial check
      .mockReturnValue({ id: 'user-1', role: 'admin', isPlatformAdmin: true }); // after refresh

    const refreshPayload = { user: { id: 'user-1', role: 'admin', isPlatformAdmin: true } };
    fetchSpy
      .mockResolvedValueOnce(createResponse(refreshPayload)) // /api/auth/refresh
      .mockResolvedValueOnce(createResponse(refreshPayload)) // /api/auth/session
      .mockResolvedValueOnce(createResponse({ data: { ok: true } })); // target request

    const { apiRequest } = await loadApiClient();
    const result = await apiRequest('/api/protected/resource');

    expect(result).toEqual({ data: { ok: true } });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/auth/refresh');
    expect(fetchSpy.mock.calls[2][0]).toContain('/api/protected/resource');
  });

  it('throws not_authenticated when refresh fails during auth gate', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    __setApiBaseUrlOverride('https://api.huddle.local');
    shouldRequireSessionSpy.mockReturnValue(true);
    getActiveSessionSpy.mockReturnValue(null);

    fetchSpy.mockResolvedValueOnce(
      createResponse({ error: 'expired' }, { status: 401 }),
    );

    const { apiRequest, ApiError } = await loadApiClient();
    await expect(apiRequest('/api/protected/resource')).rejects.toMatchObject({
      status: 401,
      body: { code: 'not_authenticated' },
    } satisfies Partial<InstanceType<typeof ApiError>>);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/auth/refresh');
  });
});
