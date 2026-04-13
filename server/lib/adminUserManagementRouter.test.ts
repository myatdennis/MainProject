import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminUserManagementRouter } from '../routes/adminUserManagement.js';

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'admin-users-req-1';
    req.user = {
      userId: '00000000-0000-0000-0000-000000000001',
      id: '00000000-0000-0000-0000-000000000001',
      isPlatformAdmin: true,
    };
    next();
  });

  const e2eStore = {
    users: [
      {
        id: 'member-1',
        user_id: 'member-1',
        organization_id: 'org-1',
        email: 'existing@example.com',
        profile: { email: 'existing@example.com' },
      },
    ],
  };

  app.use(
    '/api/admin/users',
    createAdminUserManagementRouter({
      authenticate: vi.fn((_req, _res, next) => next()),
      requireAdmin: vi.fn((_req, _res, next) => next()),
      isDemoOrTestMode: true,
      e2eStore,
      normalizeOrgIdValue: (value) => (typeof value === 'string' && value.trim() ? value.trim() : null),
      pickOrgId: (...values) => values.find((value) => typeof value === 'string' && value.trim()) ?? null,
      ensureSupabase: vi.fn(() => true),
      requireUserContext: vi.fn(() => ({
        userId: 'admin-1',
        userRole: 'admin',
        isPlatformAdmin: true,
        organizationIds: ['org-1'],
      })),
      requireOrgAccess: vi.fn(async () => true),
      runSupabaseTransientRetry: vi.fn(),
      fetchAllOrgMembersWithProfiles: vi.fn(),
      fetchOrgMembersWithProfiles: vi.fn(),
      logUsersStageError: vi.fn((stage, error) => ({
        code: error?.code ?? stage,
        message: error?.message ?? 'unexpected error',
        details: null,
      })),
      createOrProvisionOrganizationUser: vi.fn(),
      buildActorFromRequest: vi.fn(() => ({ userId: 'admin-1' })),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      supabase: null,
      sendEmail: vi.fn(),
      getOrganizationMembershipsOrgColumnName: vi.fn(async () => 'organization_id'),
      invalidateMembershipCache: vi.fn(),
      assignPublishedOrganizationContentToUser: vi.fn(),
      archiveOrganizationUserAccount: vi.fn(async ({ userId, orgId }) => ({ userId, orgId, archived: true })),
      permanentlyDeleteUserAccount: vi.fn(async () => undefined),
      normalizeOrgRole: (value) => (typeof value === 'string' && value.trim() ? value.trim() : 'member'),
      INVITE_PASSWORD_MIN_CHARS: 8,
      randomUUID: vi.fn(() => 'generated-id'),
    }),
  );

  return { app, e2eStore };
};

describe('admin user management router', () => {
  let server = null;
  let baseUrl = '';

  beforeEach(async () => {
    const context = createApp();
    server = context.app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('lists fallback org members with the shared envelope', async () => {
    const response = await fetch(`${baseUrl}/api/admin/users?orgId=org-1`, {
      headers: { 'x-user-role': 'admin', host: 'localhost' },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.meta.orgId).toBe('org-1');
  });

  it('creates fallback users with the shared envelope', async () => {
    const response = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-role': 'admin', host: 'localhost' },
      body: JSON.stringify({
        organizationId: 'org-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data.email).toBe('ada@example.com');
    expect(payload.meta.created).toBe(true);
  });

  it('rejects unsupported delete modes with the shared error envelope', async () => {
    const response = await fetch(`${baseUrl}/api/admin/users/member-1?mode=disable`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('invalid_mode');
  });
});
