import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkErrorHandler, type ApiError } from '../NetworkErrorHandler';

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: toastMock,
}));

const buildRateLimitError = (overrides: Partial<ApiError> = {}): ApiError => {
  const error = new Error('Too many requests') as ApiError;
  error.status = 429;
  error.body = {
    route: 'GET /api/demo',
    retryAfterMs: 1000,
    throttled: true,
  };
  return Object.assign(error, overrides);
};

describe('NetworkErrorHandler throttling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    toastMock.error.mockClear();
    toastMock.success.mockClear();
    const mapRef = (NetworkErrorHandler as unknown as { routeCooldowns: Map<string, number> }).routeCooldowns;
    mapRef.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks repeated calls when cooldown is active', async () => {
    const failingCall = vi.fn().mockRejectedValue(buildRateLimitError());

    await expect(
      NetworkErrorHandler.handleApiCall(failingCall, {
        throttleKey: 'GET /api/demo',
        showErrorToast: false,
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(failingCall).toHaveBeenCalledTimes(1);

    const skippedCall = vi.fn();
    await expect(
      NetworkErrorHandler.handleApiCall(skippedCall, {
        throttleKey: 'GET /api/demo',
        showErrorToast: false,
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(skippedCall).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2024-01-01T00:00:02Z'));
    const succeedingCall = vi.fn().mockResolvedValue('ok');
    const result = await NetworkErrorHandler.handleApiCall(succeedingCall, {
      throttleKey: 'GET /api/demo',
      showErrorToast: false,
    });
    expect(result).toBe('ok');
    expect(succeedingCall).toHaveBeenCalledTimes(1);
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});
