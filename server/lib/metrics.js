// Try to use prom-client when available for richer prometheus metrics. Fall back
// to a minimal in-memory collector when not installed.
let promClient = null;
try {
  // use require to avoid hard dependency; allow runtime fallback when prom-client is absent
  promClient = require('prom-client');
} catch (e) {
  promClient = null;
}

// Implementations assigned conditionally below; exported at top-level so ESM
// importers can always reference them.
let recordRequestImpl = () => {};
let recordErrorImpl = () => {};
let getMetricsTextImpl = async () => '';
let defaultExport = null;

if (promClient) {
  const register = promClient.register;
  const httpRequests = new promClient.Counter({ name: 'http_requests_total', help: 'Total HTTP requests' });
  const httpDuration = new promClient.Histogram({ name: 'http_request_duration_ms', help: 'Request duration ms', buckets: [50, 100, 200, 500, 1000, 2000, 5000] });
  const errors = new promClient.Counter({ name: 'errors_total', help: 'Total server errors' });

  recordRequestImpl = (durationMs) => {
    httpRequests.inc(1);
    httpDuration.observe(Number(durationMs) || 0);
  };

  recordErrorImpl = () => {
    errors.inc(1);
  };

  getMetricsTextImpl = async () => {
    return await register.metrics();
  };

  defaultExport = { httpRequests, httpDuration, errors, register };
} else {
  const metrics = {
    http_requests_total: 0,
    http_request_duration_ms: [],
    errors_total: 0,
  };

  recordRequestImpl = (durationMs) => {
    metrics.http_requests_total += 1;
    metrics.http_request_duration_ms.push(durationMs);
  };

  recordErrorImpl = () => {
    metrics.errors_total += 1;
  };

  getMetricsTextImpl = () => {
    const count = metrics.http_requests_total;
    const errs = metrics.errors_total;
    const durations = metrics.http_request_duration_ms.slice(-1000);
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    return `# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total ${count}\n# HELP http_request_duration_ms Average request duration (ms, last sample)\n# TYPE http_request_duration_ms gauge\nhttp_request_duration_ms ${avg}\n# HELP errors_total Total server errors\n# TYPE errors_total counter\nerrors_total ${errs}\n`;
  };

  defaultExport = metrics;
}

// Export top-level ESM bindings
export const recordRequest = (...args) => recordRequestImpl(...args);
export const recordError = (...args) => recordErrorImpl(...args);
export const getMetricsText = (...args) => getMetricsTextImpl(...args);

export default defaultExport;
