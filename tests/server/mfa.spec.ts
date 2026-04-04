import http from 'node:http';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelectChain = (result) => ({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(result),
    }),
  }),
});

const mockSupabase = {
  from: vi.fn(),
};

const mockSendMfaEmail = vi.fn();
const mockGenerateTOTPSecret = vi.fn(() => ({ base32: 'new-secret' }));
const mockGetTOTPToken = vi.fn(() => '123456');
const mockVerifyTOTPToken = vi.fn();

vi.mock('../../server/lib/supabaseClient.js', () => ({
  default: mockSupabase,
  supabaseAdminClient: mockSupabase,
  supabaseUserClient: mockSupabase,
  supabaseAuthClient: mockSupabase,
  supabaseEnv: {
    configured: true,
    urlConfigured: true,
    urlHost: 'example.supabase.co',
    hasServiceRoleKey: true,
    hasAnonKey: true,
  },
}));

vi.mock('../../server/utils/mfa.js', () => ({
  generateTOTPSecret: mockGenerateTOTPSecret,
  getTOTPToken: mockGetTOTPToken,
  verifyTOTPToken: mockVerifyTOTPToken,
  sendMfaEmail: mockSendMfaEmail,
}));

describe('mfa routes', () => {
  let server;
  let baseUrl = '';

  beforeEach(async () => {
    vi.resetModules();
    mockSupabase.from.mockReset();
    mockSendMfaEmail.mockReset();
    mockGenerateTOTPSecret.mockClear();
    mockGetTOTPToken.mockClear();
    mockVerifyTOTPToken.mockReset();

    const { default: mfaRoutes } = await import('../../server/routes/mfa.js');
    const app = express();
    app.use(express.json());
    app.use('/api/mfa', mfaRoutes);
    app.use((err, _req, res, _next) => {
      res.status(err?.status || 500).json({
        ok: false,
        data: null,
        code: err?.code || 'server_error',
        message: err?.message || 'Request failed',
      });
    });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve(undefined);
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve(undefined))));
    }
    server = null;
    baseUrl = '';
  });

  it('challenge is opaque when the account does not exist', async () => {
    mockSupabase.from.mockReturnValueOnce(
      mockSelectChain({ data: [], error: null }),
    );

    const response = await fetch(`${baseUrl}/api/mfa/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'missing@example.com' }),
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      data: { challengeAccepted: true },
      code: 'mfa_challenge_accepted',
      message: 'If the account is eligible, a verification code will be delivered.',
    });
    expect(mockSendMfaEmail).not.toHaveBeenCalled();
  });

  it('verify returns a generic failure when MFA is not configured', async () => {
    mockSupabase.from.mockReturnValueOnce(
      mockSelectChain({ data: [{ id: 'user_1', email: 'user@example.com', mfa_secret: null }], error: null }),
    );

    const response = await fetch(`${baseUrl}/api/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
    });

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload).toEqual({
      ok: false,
      data: null,
      code: 'mfa_verification_failed',
      message: 'The verification code is invalid or has expired.',
    });
  });
});
