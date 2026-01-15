import { describe, it, expect } from 'vitest';
import { scrubDiagnosticsPayload, REDACTED_VALUE } from '../scrubDiagnosticsPayload.js';

describe('scrubDiagnosticsPayload', () => {
  it('redacts sensitive keys at every depth and preserves safe fields', () => {
    const payload = {
      token: 'root-token',
      safeField: 'visible',
      nested: {
        access_token: 'access-token',
        safeNumber: 123,
        deeper: {
          refreshToken: 'refresh-token',
          password: 'password-value',
          arrayValues: [
            {
              secret: 'array-secret',
              safeLabel: 'keep-me',
              moreNested: {
                apiKey: 'api-key',
                credential: 'credential-value',
                metadata: { privateKey: 'private-value' },
              },
            },
            {
              safe: true,
            },
          ],
        },
      },
    };

    const result = scrubDiagnosticsPayload(payload);

    expect(result.token).toBe(REDACTED_VALUE);
    expect(result.nested.access_token).toBe(REDACTED_VALUE);
    expect(result.nested.deeper.refreshToken).toBe(REDACTED_VALUE);
    expect(result.nested.deeper.password).toBe(REDACTED_VALUE);
    expect(result.nested.deeper.arrayValues[0].secret).toBe(REDACTED_VALUE);
    expect(result.nested.deeper.arrayValues[0].moreNested.apiKey).toBe(REDACTED_VALUE);
    expect(result.nested.deeper.arrayValues[0].moreNested.credential).toBe(REDACTED_VALUE);
    expect(result.nested.deeper.arrayValues[0].moreNested.metadata.privateKey).toBe(REDACTED_VALUE);

    expect(result.safeField).toBe('visible');
    expect(result.nested.safeNumber).toBe(123);
    expect(result.nested.deeper.arrayValues[1].safe).toBe(true);
  });

  it('scrubs sensitive keys inside arrays while leaving other entries intact', () => {
    const payload = [
      {
        token: 'array-token',
        items: [
          { password: 'arr-password', label: 'keep' },
          'string-value',
          42,
        ],
      },
      {
        nested: [{ secret: 'inner-secret' }, { value: 'safe' }],
      },
    ];

    const result = scrubDiagnosticsPayload(payload);

    expect(result[0].token).toBe(REDACTED_VALUE);
    expect(result[0].items[0].password).toBe(REDACTED_VALUE);
    expect(result[0].items[1]).toBe('string-value');
    expect(result[0].items[2]).toBe(42);
    expect(result[1].nested[0].secret).toBe(REDACTED_VALUE);
    expect(result[1].nested[1].value).toBe('safe');
  });
});
