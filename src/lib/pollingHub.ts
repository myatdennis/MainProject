type InflightEntry = {
  promise: Promise<any>;
  expiresAt: number;
};

const DEFAULT_DEDUPE_MS = 2000;

const inflight = new Map<string, InflightEntry>();

export const fetchOnce = async (key: string, fn: () => Promise<any>, { dedupeMs = DEFAULT_DEDUPE_MS } = {}) => {
  const now = Date.now();
  const existing = inflight.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }
  const promise = (async () => {
    try {
      return await fn();
    } finally {
      // allow stale entries to expire naturally; do not delete immediately to
      // allow subsequent callers within dedupe window to reuse the result.
      setTimeout(() => {
        const entry = inflight.get(key);
        if (entry && entry.promise === promise) inflight.delete(key);
      }, Math.max(0, dedupeMs));
    }
  })();
  inflight.set(key, { promise, expiresAt: now + dedupeMs });
  return promise;
};

export const clearKey = (key: string) => {
  inflight.delete(key);
};

export default { fetchOnce, clearKey };
