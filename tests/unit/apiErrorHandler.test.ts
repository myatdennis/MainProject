import { describe, expect, it, vi } from 'vitest';
import { apiErrorHandler } from '../../server/middleware/apiErrorHandler.js';

describe('apiErrorHandler', () => {
  it('returns the standardized error payload contract', () => {
    const req = {
      headers: { accept: 'application/json' },
      method: 'GET',
      originalUrl: '/api/test',
      requestId: 'req_123',
    } as any;
    const res = {
      headersSent: false,
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    } as any;
    const next = vi.fn();
    const error = Object.assign(new Error('Boom'), { status: 503, code: 'service_unavailable' });

    apiErrorHandler(error, req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req_123');
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json; charset=utf-8');
    expect(res.statusCode).toBe(503);
    expect(res.end).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(res.end.mock.calls[0][0]);
    expect(payload).toEqual({
      ok: false,
      data: null,
      code: 'service_unavailable',
      message: 'Internal server error',
      meta: {
        requestId: 'req_123',
        status: 503,
      },
    });
  });
});
