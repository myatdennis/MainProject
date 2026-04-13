import { describe, it, expect } from 'vitest';
import analyticsRouter from '../../server/routes/analytics.js';

function findRouteHandler(router, method, path) {
  const layer = router.stack.find((l) => {
    if (!l || !l.route) return false;
    const methods = Object.keys(l.route.methods || {});
    return methods.includes(method.toLowerCase()) && l.route.path === path;
  });
  return layer ? layer.route.stack[0].handle : null;
}

function makeMockRes() {
  let statusCode = 200;
  const body = { value: null };
  return {
    status(code) { statusCode = code; return this; },
    json(payload) { body.value = payload; return this; },
    _status: () => statusCode,
    _body: () => body.value,
  };
}

describe('analytics router (unit)', () => {
  it('handles batch ingest in demo mode (no errors)', async () => {
    const handler = findRouteHandler(analyticsRouter, 'POST', '/events/batch');
    expect(typeof handler).toBe('function');

    const req = {
      body: { events: [{ clientEventId: 't1', eventType: 'test', payload: { email: 'a@b.com' } }] },
      app: { locals: {
        isDemoOrTestMode: true,
        e2eStore: { analyticsEvents: [], progressEvents: new Set() },
        persistE2EStore: async () => {},
        scrubAnalyticsPayload: (p) => p,
        normalizeOrgIdValue: (v) => v,
        logger: console,
      } },
    };
    const res = makeMockRes();

    await handler(req, res);
    const out = res._body();
    // demo mode returns an object describing accepted/duplicates/failed
    expect(out).toBeTruthy();
    expect(out.accepted || Array.isArray(out.accepted)).toBeTruthy();
  });

  it('handles single event ingest in demo mode', async () => {
    const handler = findRouteHandler(analyticsRouter, 'POST', '/events');
    expect(typeof handler).toBe('function');

    const req = {
      body: { id: 's1', event_type: 'evt', payload: { email: 'x@y.com' } },
      user: null,
      membershipStatus: null,
      ip: '127.0.0.1',
      app: { locals: {
        isDemoOrTestMode: true,
        e2eStore: { analyticsEvents: [], persistE2EStore: async () => {}, },
        persistE2EStore: async () => {},
        scrubAnalyticsPayload: (p) => p,
        getRequestContext: () => ({ userId: null, organizationIds: [] }),
        getHeaderOrgId: () => null,
        getActiveOrgFromRequest: () => null,
        normalizeOrgIdValue: () => null,
        isUuid: (v) => false,
        isAnalyticsClientEventDuplicate: () => false,
        firstRow: null,
        normalizeColumnIdentifier: (c) => c,
        extractMissingColumnName: () => null,
        logger: console,
        processGamificationEvent: null,
        upsertOrgEngagementMetrics: null,
        sql: null,
      } },
    };
    const res = makeMockRes();
    await handler(req, res);
    const out = res._body();
    expect(out).toBeTruthy();
    // demo mode returns stored status
    expect(out.data?.id || out.demo).toBeTruthy();
  });

  it('returns events list in demo mode', async () => {
    const handler = findRouteHandler(analyticsRouter, 'GET', '/events');
    expect(typeof handler).toBe('function');

    const req = { query: {}, app: { locals: { isDemoOrTestMode: true, e2eStore: { analyticsEvents: [{ id: 'e1' }] } } } };
    const res = makeMockRes();
    await handler(req, res);
    const out = res._body();
    expect(Array.isArray(out)).toBe(true);
  });
});
