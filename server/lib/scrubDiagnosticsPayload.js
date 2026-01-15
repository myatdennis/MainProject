const SENSITIVE_DIAGNOSTIC_KEY_PATTERN = /token|secret|password|key|credential/i;
const MAX_SCRUB_DEPTH = 25;
export const REDACTED_VALUE = '[redacted]';

export const scrubDiagnosticsPayload = (payload, depth = 0) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (depth > MAX_SCRUB_DEPTH) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((entry) => scrubDiagnosticsPayload(entry, depth + 1));
  }

  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (SENSITIVE_DIAGNOSTIC_KEY_PATTERN.test(key)) {
      acc[key] = REDACTED_VALUE;
      return acc;
    }

    acc[key] = scrubDiagnosticsPayload(value, depth + 1);
    return acc;
  }, {});
};

export default scrubDiagnosticsPayload;
