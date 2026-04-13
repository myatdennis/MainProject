import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRefreshTokenForRequest } from '../tokenRefresh';

const storageMock = vi.hoisted(() => ({
  getRefreshToken: vi.fn(),
}));

const supabaseAuthMock = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('../../lib/secureStorage', () => ({
  getRefreshToken: storageMock.getRefreshToken,
}));

vi.mock('../../lib/supabaseClient', () => ({
  getSupabase: () => ({ auth: supabaseAuthMock }),
}));

describe('tokenRefresh', () => {
  beforeEach(() => {
    storageMock.getRefreshToken.mockReset();
    supabaseAuthMock.getSession.mockReset();
  });

  it('prefers supabase refresh token over stored token', async () => {
    storageMock.getRefreshToken.mockReturnValue('stored-refresh');
    supabaseAuthMock.getSession.mockResolvedValue({
      data: { session: { refresh_token: 'supabase-refresh' } },
    });

    await expect(resolveRefreshTokenForRequest(null as any)).resolves.toBe('supabase-refresh');
  });
});
