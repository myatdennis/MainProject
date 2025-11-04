import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient used by the DAL request helper
let callCount = 0;
vi.mock('../../utils/apiClient', () => {
  const defaultExport = vi.fn(async () => {
    callCount++;
    // Fail twice with a retriable 500, then succeed
    if (callCount < 3) {
      const err: any = new Error('Server error');
      err.status = 500;
      err.code = 'E_SERVER';
      throw err;
    }
    return { ok: true } as any;
  });
  return { default: defaultExport };
});

import { request } from '../http';

describe('DAL request retry behavior', () => {
  beforeEach(() => {
    callCount = 0;
  });

  it('retries on 5xx errors and eventually succeeds', async () => {
    const json = await request<any>('/api/test');
    expect(json).toEqual({ ok: true });
    expect(callCount).toBe(3); // 2 failures + 1 success
  });

  it('propagates error when retries exhausted', async () => {
    // Force persistent failure by overriding mock to always throw
    const { default: apiClient } = await import('../../utils/apiClient');
    (apiClient as any).mockImplementation(async () => {
      const err: any = new Error('Server error');
      err.status = 500;
      throw err;
    });

    await expect(request<any>('/api/test')).rejects.toBeInstanceOf(Error);
  });
});
