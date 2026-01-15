import { describe, it, expect } from 'vitest';
import { buildHealthResponse } from '../healthResponse.js';
import { REDACTED_VALUE } from '../scrubDiagnosticsPayload.js';

describe('buildHealthResponse', () => {
  const basePayload = { ok: true, version: '1.2.3', env: 'test' };

  it('returns minimal payload when diagnostics are not requested', () => {
    const response = buildHealthResponse({
      basePayload,
      wantsDiagnostics: false,
      diagnosticsAllowed: false,
    });

    expect(response).toEqual(basePayload);
    expect(response).not.toHaveProperty('diagnostics');
    expect(response).not.toHaveProperty('diagnosticsDenied');
  });

  it('returns denial payload when diagnostics requested but not allowed', () => {
    const response = buildHealthResponse({
      basePayload,
      wantsDiagnostics: true,
      diagnosticsAllowed: false,
    });

    expect(response).toEqual({
      ...basePayload,
      diagnostics: null,
      diagnosticsDenied: true,
      reason: 'origin_not_allowed',
    });
  });

  it('returns sanitized diagnostics when allowed', () => {
    const diagnosticsPayload = {
      nested: {
        token: 'secret-token',
        publicInfo: 'safe',
      },
      safe: true,
    };

    const response = buildHealthResponse({
      basePayload,
      wantsDiagnostics: true,
      diagnosticsAllowed: true,
      diagnosticsPayload,
    });

    expect(response.ok).toBe(true);
    expect(response.version).toBe('1.2.3');
    expect(response.env).toBe('test');
    expect(response).not.toHaveProperty('diagnosticsDenied');
    expect(response.diagnostics.nested.token).toBe(REDACTED_VALUE);
    expect(response.diagnostics.nested.publicInfo).toBe('safe');
    expect(response.diagnostics.safe).toBe(true);
  });
});
