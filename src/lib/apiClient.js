/**
 * Secure API Client
 * Axios instance with CSRF protection and authentication
 */
import axios from 'axios';
import { ApiError as ApiClientError } from '../utils/apiClient';
import buildAuthHeaders from '../utils/requestContext';
import { getAccessToken, getAuthTokens } from '../lib/secureStorage';
import { getCSRFToken } from '../hooks/useCSRFToken';
// ============================================================================
// API Client Configuration
// ============================================================================
const DEV_API_ORIGIN = 'http://localhost:8888';
const PROD_API_ORIGIN = 'https://mainproject-production-4e66.up.railway.app';
const fallbackOrigin = import.meta.env.DEV ? DEV_API_ORIGIN : PROD_API_ORIGIN;
const envApiOrigin = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim();
const hasProtocol = /^https?:\/\//i.test(envApiOrigin);
const normalizedEnvOrigin = hasProtocol ? envApiOrigin.replace(/\/$/, '') : '';
let resolvedOrigin = normalizedEnvOrigin || fallbackOrigin;
if (resolvedOrigin.toLowerCase().endsWith('/api')) {
    resolvedOrigin = resolvedOrigin.slice(0, -4);
}
export const API_ORIGIN = resolvedOrigin;
export const API_BASE_URL = `${API_ORIGIN}/api`;
/**
 * Create secure axios instance
 */
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Send cookies with requests
});
// ============================================================================
// Request Interceptor
// ============================================================================
apiClient.interceptors.request.use(async (config) => {
    // Merge unified auth headers built from secure storage / supabase / legacy fallbacks
    try {
        const headers = await buildAuthHeaders();
        config.headers = { ...(config.headers || {}), ...headers };
    }
    catch (err) {
        // fallback: best-effort bearer from secure storage
        const token = getAccessToken();
        if (token) {
            config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
        }
    }
    // Add CSRF token for state-changing requests
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
        const csrfToken = getCSRFToken();
        if (csrfToken) {
            config.headers['x-csrf-token'] = csrfToken;
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});
// ============================================================================
// Response Interceptor
// ============================================================================
let isRefreshing = false;
let failedQueue = [];
const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        }
        else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};
apiClient.interceptors.response.use((response) => response, async (error) => {
    const originalRequest = error.config;
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
            // Queue requests while refreshing
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            })
                .then((token) => {
                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                return apiClient(originalRequest);
            })
                .catch((err) => {
                return Promise.reject(err);
            });
        }
        originalRequest._retry = true;
        isRefreshing = true;
        try {
            const tokens = getAuthTokens();
            if (!tokens?.refreshToken) {
                throw new Error('No refresh token');
            }
            // Attempt to refresh token
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refreshToken: tokens.refreshToken,
            });
            const { accessToken } = response.data;
            // Update stored token
            const { setAuthTokens } = await import('../lib/secureStorage');
            setAuthTokens({
                accessToken,
                refreshToken: response.data.refreshToken || tokens.refreshToken,
                expiresAt: response.data.expiresAt,
            });
            // Process queued requests
            processQueue(null, accessToken);
            // Retry original request
            if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            }
            return apiClient(originalRequest);
        }
        catch (refreshError) {
            processQueue(refreshError, null);
            // Clear auth and redirect to login
            const { clearAuth } = await import('../lib/secureStorage');
            clearAuth();
            // Redirect to login page
            if (typeof window !== 'undefined') {
                window.location.href = '/lms/login';
            }
            return Promise.reject(refreshError);
        }
        finally {
            isRefreshing = false;
        }
    }
    // Handle CSRF token errors
    if (error.response?.status === 403) {
        const errorData = error.response.data;
        if (errorData?.error?.includes?.('CSRF')) {
            console.error('CSRF token error:', errorData);
            // Could refresh CSRF token here
        }
    }
    // Normalize remaining errors to ApiClientError so callers can handle consistently
    try {
        const status = error.response?.status ?? 0;
        const data = error.response?.data;
        const message = (data?.message || data?.error || error.message || 'Request failed');
        const code = (error.code === 'ECONNABORTED' ? 'timeout' : data?.code);
        return Promise.reject(new ApiClientError(status, message, data, code));
    }
    catch (wrapErr) {
        return Promise.reject(error);
    }
});
// ============================================================================
// Typed API Methods
// ============================================================================
export const api = {
    /**
     * GET request
     */
    get: (url, config) => {
        return apiClient.get(url, config);
    },
    /**
     * POST request
     */
    post: (url, data, config) => {
        return apiClient.post(url, data, config);
    },
    /**
     * PUT request
     */
    put: (url, data, config) => {
        return apiClient.put(url, data, config);
    },
    /**
     * PATCH request
     */
    patch: (url, data, config) => {
        return apiClient.patch(url, data, config);
    },
    /**
     * DELETE request
     */
    delete: (url, config) => {
        return apiClient.delete(url, config);
    },
};
/**
 * Extract error message from API error
 */
export function getErrorMessage(error) {
    if (axios.isAxiosError(error)) {
        return (error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            'An error occurred');
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred';
}
/**
 * Check if error is authentication error
 */
export function isAuthError(error) {
    if (axios.isAxiosError(error)) {
        return error.response?.status === 401 || error.response?.status === 403;
    }
    return false;
}
/**
 * Check if error is network error
 */
export function isNetworkError(error) {
    if (axios.isAxiosError(error)) {
        return !error.response;
    }
    return false;
}
export default api;
