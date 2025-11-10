import apiRequest from '../utils/apiClient';
/**
 * Lightweight compatibility wrapper used across the app as `api`.
 * Keeps the older `api(path, opts)` call-site shape intact while reusing apiClient.
 */
export const api = async (path, options = {}) => {
    return await apiRequest(path, options);
};
export default api;
// Export default already provides `api` compatibility. Keep this module minimal.
