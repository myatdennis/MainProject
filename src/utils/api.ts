export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const mergedOptions: RequestInit = { ...(options || {}), credentials: 'include' };
  const res = await fetch(url, mergedOptions);
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API error: ${res.status} ${error}`);
  }
  return res.json();
}
