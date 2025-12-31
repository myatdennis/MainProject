import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockBuildAuthHeaders = vi.fn().mockResolvedValue({});
vi.mock('../requestContext', () => ({
  default: mockBuildAuthHeaders,
}));

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
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    fetchSpy.mockReset();
    mockBuildAuthHeaders.mockReset();
    mockBuildAuthHeaders.mockResolvedValue({});
    debugSpy.mockClear();
    infoSpy.mockClear();
    errorSpy.mockClear();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses VITE_API_BASE_URL for absolute requests', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ data: [] }));

    await apiRequest('/courses');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.huddle.local/courses',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('falls back to /api proxy in dev when base URL missing', async () => {
  vi.stubEnv('MODE', 'development');
  vi.stubEnv('DEV', true as any);
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ data: [] }));

    await apiRequest('/courses');

    expect(fetchSpy).toHaveBeenCalledWith('/api/courses', expect.any(Object));
  });

  it('attaches auth headers and normalizes payload casing', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
  mockBuildAuthHeaders.mockResolvedValue({ Authorization: 'Bearer secret', 'X-Org-Id': 'org-7' });
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ data: [] }));

    await apiRequest('/courses', {
      method: 'POST',
      body: JSON.stringify({ assignedTo: { organizationIds: ['org-7'] } }),
    });

    const [, options] = fetchSpy.mock.calls[0];
    const headers = options?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer secret');
    expect(headers.get('X-Org-Id')).toBe('org-7');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(options?.body).toContain('assigned_to');
  });

  it('throws ApiError with parsed message on non-2xx status', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    const { apiRequest, ApiError } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ message: 'Forbidden' }, { status: 403 }));

    await expect(apiRequest('/courses')).rejects.toBeInstanceOf(ApiError);
    expect(errorSpy).toHaveBeenCalledWith('[apiRequest] Request failed with status:', 403);
  });

  it('aborts when timeoutMs elapses', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
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

    const promise = apiRequest('/slow', { timeoutMs: 50 });
    const assertion = expect(promise).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it('logs request metadata without sensitive headers only in dev mode', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    vi.stubEnv('DEV', true as any);
    const { apiRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ data: [] }));

    await apiRequest('/courses');

    expect(debugSpy).toHaveBeenCalledWith('apiRequest', expect.objectContaining({ url: 'https://api.huddle.local/courses' }));

    vi.unstubAllEnvs();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.huddle.local');
    vi.stubEnv('DEV', false as any);
    vi.resetModules();
    const { apiRequest: prodRequest } = await loadApiClient();
    fetchSpy.mockResolvedValueOnce(createResponse({ data: [] }));

    await prodRequest('/courses');
    expect(debugSpy).toHaveBeenCalledTimes(1);
  });
});
