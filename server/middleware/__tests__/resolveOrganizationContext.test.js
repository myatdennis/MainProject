import { describe, it, expect, vi } from 'vitest';
import { resolveOrganizationContext } from '../auth.js';

const buildRes = () => {
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
  return res;
};

describe('resolveOrganizationContext', () => {
  it('requires explicit org selection for multi-org non-platform admins', () => {
    const req = {
      user: {
        isPlatformAdmin: false,
        organizationIds: ['org-1', 'org-2'],
        activeOrgId: null,
      },
      activeOrgId: null,
      headers: {},
      query: {},
      path: '/api/admin/courses',
      method: 'GET',
    };
    const res = buildRes();
    const next = vi.fn();

    resolveOrganizationContext(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.payload?.code).toBe('org_selection_required');
  });

  it('infers the org context when exactly one org membership exists', () => {
    const req = {
      user: {
        isPlatformAdmin: false,
        organizationIds: ['org-1'],
        activeOrgId: null,
      },
      activeOrgId: null,
      headers: {},
      query: {},
      path: '/api/admin/courses',
      method: 'GET',
    };
    const res = buildRes();
    const next = vi.fn();

    resolveOrganizationContext(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(req.activeOrgId).toBe('org-1');
    expect(next).toHaveBeenCalledTimes(1);
  });
});

