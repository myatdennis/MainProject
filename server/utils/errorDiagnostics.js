import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIAG_DIR = path.join(__dirname, '..', 'diagnostics');

const ensureDiagDir = () => {
  try {
    if (!fs.existsSync(DIAG_DIR)) {
      fs.mkdirSync(DIAG_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[diagnostics] Failed to ensure diagnostics directory', err);
  }
};

const SENSITIVE_HEADER_PATTERNS = [/authorization/i, /cookie/i, /token/i, /secret/i, /key/i];
const SENSITIVE_BODY_KEYS = [/password/i, /token/i, /secret/i, /key/i];

const normalizeHeaderValue = (value) => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
};

const sanitizeHeaderEntry = (key, value) => {
  const normalized = normalizeHeaderValue(value);
  if (!normalized) return normalized;
  if (SENSITIVE_HEADER_PATTERNS.some((pattern) => pattern.test(key))) {
    return '[redacted]';
  }
  return normalized.length > 512 ? `${normalized.slice(0, 512)}…` : normalized;
};

export const sanitizeHeaders = (headers = {}) => {
  if (!headers || typeof headers !== 'object') {
    return {};
  }
  const sanitized = {};
  Object.entries(headers).forEach(([key, value]) => {
    sanitized[key] = sanitizeHeaderEntry(key, value);
  });
  return sanitized;
};

const HEADER_SUMMARY_KEYS = [
  'host',
  'origin',
  'referer',
  'user-agent',
  'content-type',
  'accept',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-request-id',
  'cf-connecting-ip',
];

export const summarizeHeaders = (headers = {}) => {
  const sanitized = sanitizeHeaders(headers);
  const summary = {};
  HEADER_SUMMARY_KEYS.forEach((key) => {
    if (sanitized[key]) {
      summary[key] = sanitized[key];
    }
  });
  return summary;
};

export const summarizeRequestBody = (body) => {
  if (body === null || body === undefined) return null;
  if (typeof body !== 'object') {
    return typeof body === 'string' && body.length > 120 ? `${body.slice(0, 120)}…` : body;
  }
  const summary = {};
  Object.entries(body).forEach(([key, value]) => {
    if (SENSITIVE_BODY_KEYS.some((pattern) => pattern.test(key))) {
      summary[key] = '[redacted]';
      return;
    }
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      summary[key] =
        typeof value === 'string' && value.length > 120 ? `${value.slice(0, 120)}…` : value;
    } else if (Array.isArray(value)) {
      summary[key] = `Array(${value.length})`;
    } else if (typeof value === 'object') {
      summary[key] = `Object(${Object.keys(value).length})`;
    } else {
      summary[key] = typeof value;
    }
  });
  return summary;
};

export const writeErrorDiagnostics = (req, err, extra = {}) => {
  try {
    ensureDiagDir();
    const requestId = String(extra.requestId || req?.requestId || randomUUID());
    const payload = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req?.method || extra.method || 'UNKNOWN',
      path: req?.originalUrl || req?.url || req?.path || extra.path || 'UNKNOWN',
      headers: sanitizeHeaders(req?.headers || {}),
      headersSummary: summarizeHeaders(req?.headers || {}),
      body: summarizeRequestBody(req?.body ?? null),
      error: {
        message: err?.message || String(err),
        stack: err?.stack || null,
        code: err?.code || extra.code || null,
      },
    };
    if (extra.meta && typeof extra.meta === 'object') {
      payload.meta = extra.meta;
    }
    const file = path.join(DIAG_DIR, `error-${requestId}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    return file;
  } catch (writeErr) {
    console.warn('[diagnostics] Failed to write error file', writeErr);
    return null;
  }
};

export default writeErrorDiagnostics;
