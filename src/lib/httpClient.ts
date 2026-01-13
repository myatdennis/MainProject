import axios, { AxiosHeaders } from 'axios';
import { getApiBaseUrl, buildApiUrl, assertNoDoubleApi } from '../config/apiBase';
import buildAuthHeaders from '../utils/requestContext';
import { getCSRFToken } from '../hooks/useCSRFToken';

const resolvedBaseUrl = getApiBaseUrl();
const api = axios.create({
  baseURL: resolvedBaseUrl || buildApiUrl('/api'),
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

  const finalUrl = axios.getUri(config);
  assertNoDoubleApi(finalUrl);
  return config;
});

export default api;
