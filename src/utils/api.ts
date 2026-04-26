export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const { default: authorizedFetch } = await import('../lib/authorizedFetch');
  const mergedOptions: RequestInit = { ...(options || {}) };
  const res = await authorizedFetch(url, mergedOptions);
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API error: ${res.status} ${error}`);
  }
  return res.json();
}
