import axios, { AxiosHeaders } from 'axios';
import { resolveApiUrl } from '../config/apiBase';
import buildAuthHeaders from '../utils/requestContext';
import { getCSRFToken } from '../hooks/useCSRFToken';

const api = axios.create({
  baseURL: resolveApiUrl('/api'),
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  let existingHeaders: Record<string, any> = {};

  if (config.headers instanceof AxiosHeaders) {
    existingHeaders = config.headers.toJSON();
  } else if (config.headers) {
    existingHeaders = { ...(config.headers as Record<string, any>) };
  }

  config.headers = new AxiosHeaders({
    ...existingHeaders,
    ...(await buildAuthHeaders()),
  });

  const method = config.method?.toLowerCase();
  if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
    const csrfToken = typeof document !== 'undefined' ? getCSRFToken() : null;
    if (csrfToken) {
      config.headers['x-csrf-token'] = csrfToken;
    }
  }

  return config;
});

export default api;
