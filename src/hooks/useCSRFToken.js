/**
 * CSRF Token Hook
 * Client-side CSRF token management
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
const CSRF_COOKIE_NAME = 'csrf_token';
// ============================================================================
// CSRF Token Hook
// ============================================================================
/**
 * Hook to manage CSRF tokens
 */
export function useCSRFToken() {
    const [token, setToken] = useState('');
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
                // If not in cookie, fetch from server
                const response = await axios.get('/api/csrf-token');
                if (response.data.csrfToken) {
                    setToken(response.data.csrfToken);
                }
            }
            catch (error) {
                console.error('Failed to fetch CSRF token:', error);
            }
            finally {
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
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Get CSRF token from cookie
 */
export function getCSRFCookie() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === CSRF_COOKIE_NAME) {
            return decodeURIComponent(value);
        }
    }
    return null;
}
/**
 * Get current CSRF token
 */
export function getCSRFToken() {
    return getCSRFCookie();
}
