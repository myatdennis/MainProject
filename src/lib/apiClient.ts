/**
 * Secure API Client
 * Axios instance with CSRF protection and authentication
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { ApiError as ApiClientError } from '../utils/apiClient';
import buildAuthHeaders from '../utils/requestContext';
import { setSessionMetadata, clearAuth, getRefreshToken, setAccessToken, setRefreshToken } from '../lib/secureStorage';
import { getCSRFToken } from '../hooks/useCSRFToken';
import { getApiBaseUrl } from '../config/apiBase';

// ============================================================================
// API Client Configuration
// ============================================================================

const API_BASE_URL = getApiBaseUrl();
const API_ROOT = API_BASE_URL;

if (
  import.meta.env.DEV &&
  API_BASE_URL &&
  /^https?:\/\//i.test(API_BASE_URL) &&
  !/^https?:\/\/(localhost|127(?:\.[0-9]+){0,2}\.[0-9]+|\[::1\])(:|$)/i.test(API_BASE_URL)
) {
  console.warn('[apiClient] VITE_API_BASE_URL points to a non-local host in development:', API_BASE_URL);
  console.warn('Consider using the local proxy (/api) to avoid writing to production by accident.');
}

/**
 * Create secure axios instance
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_ROOT,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
});

// ============================================================================
// Request Interceptor
// ============================================================================

apiClient.interceptors.request.use(
  async (config) => {
    // Merge unified auth headers built from secure storage / supabase / legacy fallbacks
    try {
      const headers = await buildAuthHeaders();
      config.headers = { ...(config.headers || {}), ...headers } as any;
    } catch (err) {
      console.warn('[apiClient] Failed to build auth headers. Proceeding without enrichment.', err);
    }

    // Add CSRF token for state-changing requests
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      let csrfToken = getCSRFToken();

      // If the cookie-based token is not present, fetch it from server
      // so state-changing requests include the required header.
      if (!csrfToken) {
        try {
          await axios.get(`${API_BASE_URL}/auth/csrf`, { withCredentials: true });
          csrfToken = getCSRFToken();
        } catch (err) {
          // If fetching token fails, proceed without it; server will return 403 and caller will handle
          console.warn('Failed to fetch CSRF token before request', err);
        }
      }
      if (csrfToken) {
        config.headers['x-csrf-token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================================================
// Response Interceptor
// ============================================================================

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });

  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue requests while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = getRefreshToken();
        if (!storedRefreshToken) {
          throw new Error('No refresh token available for session refresh.');
        }

        // Attempt to refresh session using stored tokens
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken: storedRefreshToken },
          { withCredentials: true }
        );

        if (response.data?.accessToken) {
          setAccessToken(response.data.accessToken);
        }

        if (response.data?.refreshToken) {
          setRefreshToken(response.data.refreshToken);
        }

        if (response.data?.expiresAt || response.data?.refreshExpiresAt) {
          setSessionMetadata({
            accessExpiresAt: response.data.expiresAt,
            refreshExpiresAt: response.data.refreshExpiresAt,
          });
        }

        // Process queued requests
        processQueue(null);

        // Retry original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error);

        // Clear auth and redirect to login
        clearAuth();

        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/lms/login';
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle CSRF token errors
    if (error.response?.status === 403) {
      const errorData = error.response.data as any;
      if (errorData?.error?.includes?.('CSRF')) {
        console.error('CSRF token error:', errorData);
        // Could refresh CSRF token here
      }
    }

    // Normalize remaining errors to ApiClientError so callers can handle consistently
    try {
      const status = error.response?.status ?? 0;
      const data: any = error.response?.data;
      const message = (data?.message || data?.error || error.message || 'Request failed') as string;
      const code = (error.code === 'ECONNABORTED' ? 'timeout' : data?.code) as string | undefined;
      return Promise.reject(new ApiClientError(status, message, data, code));
    } catch (wrapErr) {
      return Promise.reject(error);
    }
  }
);

// ============================================================================
// Typed API Methods
// ============================================================================

export const api = {
  /**
   * GET request
   */
  get: <T = any>(url: string, config?: AxiosRequestConfig) => {
    return apiClient.get<T>(url, config);
  },

  /**
   * POST request
   */
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => {
    return apiClient.post<T>(url, data, config);
  },

  /**
   * PUT request
   */
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => {
    return apiClient.put<T>(url, data, config);
  },

  /**
   * PATCH request
   */
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => {
    return apiClient.patch<T>(url, data, config);
  },

  /**
   * DELETE request
   */
  delete: <T = any>(url: string, config?: AxiosRequestConfig) => {
    return apiClient.delete<T>(url, config);
  },
};

// ============================================================================
// Error Helpers
// ============================================================================

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

/**
 * Extract error message from API error
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An error occurred'
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred';
}

/**
 * Check if error is authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === 401 || error.response?.status === 403;
  }
  return false;
}

/**
 * Check if error is network error
 */
export function isNetworkError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return !error.response;
  }
  return false;
}

export default api;