/**
 * CSRF Token Hook
 * Client-side CSRF token management
 */

import { useState, useEffect } from 'react';
import { ApiError, apiRequest } from '../utils/apiClient';
import { CSRF_COOKIE_NAME, getCSRFCookie, getCSRFToken } from '../utils/csrfToken';

// ============================================================================
// CSRF Token Hook
// ============================================================================

/**
 * Hook to manage CSRF tokens
 */
export function useCSRFToken() {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchToken() {
      try {
        // First try to get from cookie
        const cookieToken = getCSRFCookie();
        if (cookieToken) {
          setToken(cookieToken);
          setLoading(false);
          return;
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          // Offline: keep current token/cookie and exit silently.
          return;
        }

        try {
          const response = await apiRequest<{ csrfToken?: string; token?: string }>('/api/auth/csrf', {
            method: 'GET',
            allowAnonymous: true,
            timeoutMs: 4000,
          });

          const csrfToken = response?.csrfToken ?? response?.token ?? null;
          if (csrfToken) {
            setToken(csrfToken);
          }
        } catch (error) {
          if (import.meta.env?.DEV) {
            if (error instanceof ApiError) {
              console.warn('Failed to fetch CSRF token (ApiError):', error.status, error.body);
            } else {
              console.warn('Failed to fetch CSRF token:', error);
            }
          }
        }
      } catch (error) {
        if (import.meta.env?.DEV) {
          console.warn('Failed to fetch CSRF token:', error);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchToken();

    // Refresh token periodically
    const interval = setInterval(fetchToken, 60 * 60 * 1000); // Every hour

    return () => clearInterval(interval);
  }, []);

  return { token, loading };
}

/**
 * Get CSRF token from cookie
 */
export { getCSRFCookie, getCSRFToken } from '../utils/csrfToken';
