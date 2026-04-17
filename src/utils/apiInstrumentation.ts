// Lightweight client-side API instrumentation for page-load metrics
// Stores metrics on window.__API_METRICS so tests and dev tools can read them.

type ApiMetric = { url: string; method: string; start: number; durationMs?: number; status?: number };

const ensureGlobal = () => {
  if (typeof window === 'undefined') return null as any;
  (window as any).__API_METRICS = (window as any).__API_METRICS || {
    requests: [] as ApiMetric[],
    startedAt: Date.now(),
  };
  return (window as any).__API_METRICS;
};

export function startApiRequest(url: string, method = 'GET') {
  const g = ensureGlobal();
  if (!g) return null;
  const entry: ApiMetric = { url, method, start: Date.now() };
  g.requests.push(entry);
  return entry;
}

export function endApiRequest(entry: ApiMetric | null, status?: number) {
  if (!entry) return;
  entry.durationMs = Date.now() - entry.start;
  if (typeof status === 'number') entry.status = status;
}

export function getPageApiMetrics() {
  const g = ensureGlobal();
  if (!g) return { requests: [], startedAt: Date.now() };
  return g;
}

export function resetPageApiMetrics() {
  const g = ensureGlobal();
  if (!g) return;
  g.requests = [];
  g.startedAt = Date.now();
}
