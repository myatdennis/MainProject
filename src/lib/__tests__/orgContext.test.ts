import { describe, expect, it, afterEach } from 'vitest';
import { __setTestOrgContext, resolveOrgHeaderForRequest, pathRequiresOrgHeader } from '../orgContext';

describe('orgContext header resolution', () => {
  afterEach(() => {
    __setTestOrgContext(null);
  });

  it('requires org header for content endpoints but not admin endpoints', () => {
    expect(pathRequiresOrgHeader('/api/courses')).toBe(true);
    expect(pathRequiresOrgHeader('/api/admin/courses')).toBe(true);
    expect(pathRequiresOrgHeader('/api/client/courses')).toBe(false);
  });

  it('returns null for admin routes when no global org is available', () => {
    __setTestOrgContext(null);
    expect(resolveOrgHeaderForRequest('/api/admin/me')).toBeNull();
    expect(resolveOrgHeaderForRequest('/api/admin/courses')).toBeNull();
  });

  it('throws when a required non-admin org route is missing org context', () => {
    __setTestOrgContext(null);
    expect(() => resolveOrgHeaderForRequest('/api/courses')).toThrow('[client] missing_org_context');
  });

  it('uses the configured active org for required routes', () => {
    __setTestOrgContext('org-123');
    expect(resolveOrgHeaderForRequest('/api/admin/courses')).toBe('org-123');
    expect(resolveOrgHeaderForRequest('/api/courses')).toBe('org-123');
  });
});
