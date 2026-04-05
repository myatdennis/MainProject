import { describe, expect, it } from 'vitest';
import { ApiError } from '../apiClient';
import { resolveUserFacingError } from '../userFacingError';

describe('resolveUserFacingError', () => {
  it('returns api body message when available', () => {
    const error = new ApiError('Request failed', 400, '/api/test', {
      message: 'Friendly API message',
    });

    expect(
      resolveUserFacingError(error, {
        fallback: 'Fallback message',
      }),
    ).toBe('Friendly API message');
  });

  it('returns fallback copy when message is unavailable', () => {
    expect(
      resolveUserFacingError(null, {
        fallback: 'Fallback message',
      }),
    ).toBe('Fallback message');
  });
});
