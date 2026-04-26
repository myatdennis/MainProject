// Capture the original/native fetch implementation at module load time so
// higher-level wrappers can rely on an unmodified transport even if the
// global `fetch` is later overridden to enforce usage of authorizedFetch.
const nativeFetchRef = (() => {
  try {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      return window.fetch.bind(window);
    }
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).fetch === 'function') {
      return (globalThis as any).fetch.bind(globalThis);
    }
  } catch {
    // ignore
  }
  // As a last resort, return undefined — callers must handle the absence.
  return undefined as unknown as typeof fetch;
})();

export function getNativeFetch(): typeof fetch | undefined {
  return nativeFetchRef;
}

export function installUnsafeGlobalFetch(): void {
  if (typeof window === 'undefined') return;
  // Only install once
  const g = window as any;
  if (g.__unsafe_fetch_installed__) return;
  g.__unsafe_fetch_installed__ = true;

  g.__original_fetch__ = typeof g.fetch === 'function' ? g.fetch : g.__original_fetch__;

  g.fetch = function unsafeFetch(): Promise<never> {
    throw new Error('DO NOT USE DIRECT FETCH — use authorizedFetch');
  } as any;
}

export function restoreOriginalGlobalFetch(): void {
  if (typeof window === 'undefined') return;
  const g = window as any;
  if (g.__original_fetch__) {
    g.fetch = g.__original_fetch__;
    delete g.__original_fetch__;
  }
  delete g.__unsafe_fetch_installed__;
}

export default getNativeFetch;
