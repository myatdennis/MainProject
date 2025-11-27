import buildAuthHeaders from './requestContext';

// Key transform utilities to normalize wire format (snake_case) <-> client (camelCase)
const isObject = (val: any) => Object.prototype.toString.call(val) === '[object Object]';

const toSnake = (str: string) =>
  str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();

const toCamel = (str: string) => str.replace(/[_-](\w)/g, (_, c) => (c ? c.toUpperCase() : ''));

// Avoid transforming arbitrary nested JSON blobs (e.g., lesson content bodies)
// When skip is true, we avoid transforming BOTH the key and its nested children.
const shouldSkipKeyTransform = (parentKey: string | null, key: string): boolean => {
  // Do not transform content bodies or any *_json blobs (and do not recurse into them)
  if (key === 'body') return true;
  if (key.endsWith('_json')) return true;
  if (parentKey && (parentKey.endsWith('_json') || parentKey === 'content' || parentKey === 'metadata')) return true;
  return false;
};

const transformKeysDeep = (
  input: any,
  direction: 'toSnake' | 'toCamel',
  parentKey: string | null = null,
): any => {
  if (Array.isArray(input)) {
    return input.map((v) => transformKeysDeep(v, direction, parentKey));
  }
  if (!isObject(input)) return input;

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    const skip = shouldSkipKeyTransform(parentKey, k);
    const nextKey = skip ? k : direction === 'toSnake' ? toSnake(k) : toCamel(k);
    // If this key should be skipped, assign value as-is without recursing
    out[nextKey] = skip ? v : transformKeysDeep(v, direction, nextKey);
  }
  return out;
};

// Resolve API base URL from Vite env, and fall back to a Railway host in production when undefined.
const rawApiBaseEnv = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
let API_BASE_URL = rawApiBaseEnv;
// When not set, prefer an explicit Railway host for production builds to avoid broken /api references
// (This improves resilience for deployments that don't configure VITE_API_BASE_URL in the hosting UI.)
if (!API_BASE_URL && import.meta.env.MODE === 'production') {
  API_BASE_URL = 'https://mainproject-production-4e66.up.railway.app';
  console.info('[apiClient] VITE_API_BASE_URL not set — defaulting to Railway host:', API_BASE_URL);
}

if (!API_BASE_URL) {
  console.warn('[apiClient] VITE_API_BASE_URL is not set. Requests will fail until configured.');
}

export class ApiError extends Error {
  status: number;
  code?: string;
  body: unknown;

  constructor(status: number, message: string, body: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export interface ApiRequestOptions extends RequestInit {
  /**
   * Additional expected HTTP status codes besides the 2xx range.
   */
  expectedStatus?: number | number[];
  /**
   * Optional validation step for the parsed response body.
   */
  validate?: (data: any) => void;
  /**
   * Skip JSON parsing even if content-type is application/json.
   */
  rawResponse?: boolean;
  /**
   * Disable automatic camel/snake case transformation.
   */
  noTransform?: boolean;
  /**
   * Optional timeout in milliseconds. If exceeded, the request is aborted.
   */
  timeoutMs?: number;
}

const buildUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const shouldParseJson = (response: Response, options: ApiRequestOptions) => {
  if (options.rawResponse) return false;
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json');
};

const statusMatches = (status: number, expected?: number | number[]) => {
  if (!expected) return false;
  if (Array.isArray(expected)) return expected.includes(status);
  return expected === status;
};

export const apiRequest = async <T = any>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  console.log('[apiRequest] Starting request to:', path);
  
  const headers = options.headers instanceof Headers ? new Headers(options.headers) : new Headers(options.headers ?? {});
  
  try {
    const authHeaders = await buildAuthHeaders();
    console.log('[apiRequest] Auth headers:', authHeaders);
    Object.entries(authHeaders).forEach(([key, value]) => {
      if (value && !headers.has(key)) {
        headers.set(key, value);
      }
    });
  } catch (error) {
    console.error('[apiRequest] Failed to build auth headers:', error);
    throw error;
  }

  if (!headers.has('Content-Type') && options.method && options.method !== 'GET' && options.method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  // Normalize outgoing JSON body to snake_case unless disabled
  let body = options.body as any;
  if (!options.noTransform && body && typeof body === 'string' && headers.get('Content-Type')?.includes('application/json')) {
    try {
      const parsed = JSON.parse(body);
      body = JSON.stringify(transformKeysDeep(parsed, 'toSnake'));
    } catch {
      // leave as-is if parsing fails
    }
  }

  // Compose AbortController for timeout and external signal
  const controller = new AbortController();
  const signals: AbortSignal[] = [];
  if (options.signal) signals.push(options.signal);
  const timeout = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? setTimeout(() => controller.abort(new DOMException('Request timed out', 'AbortError')), options.timeoutMs)
    : null;
  const onExternalAbort = () => controller.abort(new DOMException('Aborted', 'AbortError'));
  signals.forEach((sig) => sig.addEventListener('abort', onExternalAbort));

  const requestInit: RequestInit = {
    ...options,
    signal: controller.signal,
    headers,
    body,
  };

  const url = buildUrl(path);
  console.log('[apiRequest] Fetching URL:', url);

  let response: Response;
  try {
    response = await fetch(url, requestInit);
  } catch (err: any) {
    if (timeout) clearTimeout(timeout as any);
    signals.forEach((sig) => sig.removeEventListener('abort', onExternalAbort));
    if (err?.name === 'AbortError') {
      throw new ApiError(0, 'Request aborted (timeout or cancel)', null, 'timeout');
    }
    throw err;
  }
  console.log('[apiRequest] Response status:', response.status, response.statusText);

  const okStatus = response.ok || statusMatches(response.status, options.expectedStatus);

  const parseJson = shouldParseJson(response, options);
  let responseBody: unknown = null;

  if (parseJson) {
    try {
      const raw = await response.json();
      console.log('[apiRequest] Raw response:', raw);
      responseBody = options.noTransform ? raw : transformKeysDeep(raw, 'toCamel');
      console.log('[apiRequest] Transformed response:', responseBody);
    } catch (error) {
      console.error('[apiRequest] Failed to parse JSON:', error);
      if (okStatus) {
        throw new ApiError(response.status, 'Failed to parse JSON response', null);
      }
    }
  } else if (!okStatus) {
    responseBody = await response.text();
  }

  if (!okStatus) {
    console.error('[apiRequest] Request failed with status:', response.status);
    const errorMessage =
      typeof responseBody === 'object' && responseBody !== null && 'message' in responseBody
        ? String((responseBody as any).message)
        : `Request failed with status ${response.status}`;
    const errorCode =
      typeof responseBody === 'object' && responseBody !== null && 'code' in responseBody
        ? String((responseBody as any).code)
        : undefined;
    throw new ApiError(response.status, errorMessage, responseBody, errorCode);
  }

  if (options.validate) {
    options.validate(responseBody);
  }

  if (timeout) clearTimeout(timeout as any);
  signals.forEach((sig) => sig.removeEventListener('abort', onExternalAbort));
  return responseBody as T;
};

export default apiRequest;
