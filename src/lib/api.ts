import apiRequest, { ApiRequestOptions } from '../utils/apiClient';

/**
 * Lightweight compatibility wrapper used across the app as `api`.
 * Keeps the older `api(path, opts)` call-site shape intact while reusing apiClient.
 */
export const api = async <T = any>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  return await apiRequest<T>(path, options);
};

export default api;
// Export default already provides `api` compatibility. Keep this module minimal.
