import buildAuthHeaders from './requestContext';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
  const headers = options.headers instanceof Headers ? new Headers(options.headers) : new Headers(options.headers ?? {});
  const authHeaders = await buildAuthHeaders();
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (value && !headers.has(key)) {
      headers.set(key, value);
    }
  });

  if (!headers.has('Content-Type') && options.method && options.method !== 'GET' && options.method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  const requestInit: RequestInit = {
    ...options,
    headers,
  };

  const url = buildUrl(path);

  const response = await fetch(url, requestInit);

  const okStatus = response.ok || statusMatches(response.status, options.expectedStatus);

  const parseJson = shouldParseJson(response, options);
  let responseBody: unknown = null;

  if (parseJson) {
    try {
      responseBody = await response.json();
    } catch (error) {
      if (okStatus) {
        throw new ApiError(response.status, 'Failed to parse JSON response', null);
      }
    }
  } else if (!okStatus) {
    responseBody = await response.text();
  }

  if (!okStatus) {
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

  return responseBody as T;
};

export default apiRequest;
