import { describe, it, expect, vi } from 'vitest';
import { createOrProvisionOrganizationUser } from '../../services/userProvisioning.js';

type AuthUser = { id: string; email: string };

type SupabaseStore = {
  authUsers: Map<string, AuthUser>;
  profiles: Map<string, any>;
  memberships: Map<string, any>;
  adminUsers: Map<string, any>;
};

type MockOptions = {
  createUserError?: any;
  profileUpsertError?: any;
  membershipUpsertError?: any;
  adminUpsertError?: any;
  skipProfileStore?: boolean;
  skipMembershipStore?: boolean;
  setupLink?: string | null;
  forceGetUserByEmailNotFound?: boolean;
};

const createMockSupabase = ({
  createUserError = null,
  profileUpsertError = null,
  membershipUpsertError = null,
  adminUpsertError = null,
  skipProfileStore = false,
  skipMembershipStore = false,
  setupLink = 'https://setup.link/token',
  forceGetUserByEmailNotFound = false,
}: MockOptions = {}) => {
  const store: SupabaseStore = {
    authUsers: new Map(),
    profiles: new Map(),
    memberships: new Map(),
    adminUsers: new Map(),
  };

  const authAdmin = {
    createUser: vi.fn(async ({ email, user_metadata }) => {
      if (createUserError) {
        return { data: null, error: createUserError };
      }
      if (store.authUsers.has(email)) {
        return { data: null, error: { message: 'User already registered', status: 409 } };
      }
      const user = { id: `user-${store.authUsers.size + 1}`, email, user_metadata };
      store.authUsers.set(email, user);
      return { data: { user }, error: null };
    }),
    getUserByEmail: vi.fn(async (email: string) => {
      if (forceGetUserByEmailNotFound) {
        return { data: { user: null }, error: { message: 'User not found' } };
      }
      const user = store.authUsers.get(email) ?? null;
      return { data: { user }, error: user ? null : { message: 'User not found' } };
    }),
    listUsers: vi.fn(async () => ({ data: { users: Array.from(store.authUsers.values()) }, error: null })),
    updateUserById: vi.fn(async (id: string, payload: any) => {
      const user = Array.from(store.authUsers.values()).find((entry) => entry.id === id);
      if (user) {
        store.authUsers.set(user.email, { ...user, ...payload });
      }
      return { data: { user }, error: null };
    }),
    generateLink: vi.fn(async () => {
      if (!setupLink) return { data: null, error: { message: 'no link' } };
      return { data: { action_link: setupLink }, error: null };
    }),
    getUserById: vi.fn(async (id: string) => {
      const user = Array.from(store.authUsers.values()).find((entry) => entry.id === id) ?? null;
      return { data: { user }, error: user ? null : { message: 'User not found' } };
    }),
    deleteUser: vi.fn(async () => ({ data: null, error: null })),
  };

  const createTableApi = (table: string) => ({
    upsert: (payload: any) => {
      if (table === 'user_profiles' && profileUpsertError) {
        return { data: null, error: profileUpsertError };
      }
      if (table === 'organization_memberships' && membershipUpsertError) {
        return {
          select: () => ({
            single: async () => ({ data: null, error: membershipUpsertError }),
          }),
        };
      }
      if (table === 'user_profiles') {
        if (!skipProfileStore) {
          store.profiles.set(payload.id, payload);
        }
        return { data: payload, error: null };
      }
      if (table === 'organization_memberships') {
        const key = `${payload.organization_id || payload.org_id}:${payload.user_id}`;
        if (!skipMembershipStore) {
          store.memberships.set(key, { id: `mem-${store.memberships.size + 1}`, ...payload });
        }
        return {
          select: () => ({
            single: async () => ({ data: store.memberships.get(key), error: null }),
          }),
        };
      }
      if (table === 'admin_users') {
        if (adminUpsertError) {
          return { data: null, error: adminUpsertError };
        }
        const key = `${payload.organization_id}:${payload.user_id}`;
        store.adminUsers.set(key, payload);
        return { data: payload, error: null };
      }
      return { data: payload, error: null };
    },
    select: () => {
      const filters: Record<string, any> = {};
      const query: any = {
        eq: (col: string, val: any) => {
          filters[col] = val;
          return query;
        },
        maybeSingle: async () => {
          if (table === 'user_profiles') {
            const profile = store.profiles.get(filters.id ?? filters.user_id ?? filters.email) ?? null;
            return { data: profile, error: null };
          }
          if (table === 'organization_memberships') {
            const membership = Array.from(store.memberships.values()).find((entry) => {
              const orgMatch =
                (filters.organization_id && entry.organization_id === filters.organization_id) ||
                (filters.org_id && entry.org_id === filters.org_id) ||
                (!filters.organization_id && !filters.org_id);
              const userMatch = !filters.user_id || entry.user_id === filters.user_id;
              return orgMatch && userMatch;
            }) ?? null;
            return { data: membership, error: null };
          }
          return { data: null, error: null };
        },
        single: async () => {
          if (table === 'user_profiles') {
            const profile = store.profiles.get(filters.id ?? filters.user_id ?? filters.email) ?? null;
            return { data: profile, error: null };
          }
          return { data: null, error: null };
        },
      };
      return query;
    },
    delete: () => ({
      eq: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  });

  return {
    store,
    supabase: {
      auth: { admin: authAdmin },
      from: (table: string) => createTableApi(table),
    },
  };
};

describe('createOrProvisionOrganizationUser', () => {
  it('creates a new auth user, profile, membership, and setup link', async () => {
    const { supabase } = createMockSupabase();
    const sendEmail = vi.fn(async () => ({ delivered: true, id: 'msg-1' }));

    const result = await createOrProvisionOrganizationUser(
      {
        orgId: 'org-1',
        email: 'new@user.com',
        firstName: 'New',
        lastName: 'User',
        membershipRole: 'member',
      },
      { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
    );

    expect(result.created).toBe(true);
    expect(result.setupLink).toContain('https://setup.link');
    expect(result.emailSent).toBe(true);
  });

  it('reuses existing auth user when already registered', async () => {
    const { supabase, store } = createMockSupabase();
    store.authUsers.set('existing@user.com', { id: 'user-10', email: 'existing@user.com' });
    const sendEmail = vi.fn(async () => ({ delivered: true, id: 'msg-2' }));

    const result = await createOrProvisionOrganizationUser(
      {
        orgId: 'org-1',
        email: 'existing@user.com',
        firstName: 'Existing',
        lastName: 'User',
        membershipRole: 'member',
      },
      { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
    );

    expect(result.created).toBe(false);
    expect(result.userId).toBe('user-10');
  });

  it('preserves existing profile organization when adding membership to another org', async () => {
    const { supabase, store } = createMockSupabase();
    store.authUsers.set('multi@user.com', { id: 'user-12', email: 'multi@user.com' });
    store.profiles.set('user-12', {
      id: 'user-12',
      email: 'multi@user.com',
      organization_id: 'org-1',
      active_organization_id: 'org-1',
    });
    const sendEmail = vi.fn(async () => ({ delivered: true, id: 'msg-4' }));

    await createOrProvisionOrganizationUser(
      {
        orgId: 'org-2',
        email: 'multi@user.com',
        firstName: 'Multi',
        lastName: 'Org',
        membershipRole: 'member',
      },
      { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
    );

    const profile = store.profiles.get('user-12');
    expect(profile.organization_id).toBe('org-1');
    expect(profile.active_organization_id).toBe('org-1');
    expect(store.memberships.has('org-2:user-12')).toBe(true);
  });

  it('falls back to listUsers when getUserByEmail reports not found', async () => {
    const { supabase, store } = createMockSupabase({ forceGetUserByEmailNotFound: true });
    store.authUsers.set('fallback@user.com', { id: 'user-11', email: 'fallback@user.com' });
    const sendEmail = vi.fn(async () => ({ delivered: true, id: 'msg-3' }));

    const result = await createOrProvisionOrganizationUser(
      {
        orgId: 'org-1',
        email: 'fallback@user.com',
        firstName: 'Fallback',
        lastName: 'User',
        membershipRole: 'member',
      },
      { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
    );

    expect(result.created).toBe(false);
    expect(result.userId).toBe('user-11');
  });

  it('fails when profile upsert fails', async () => {
    const { supabase } = createMockSupabase({ profileUpsertError: { message: 'profile failed' } });
    const sendEmail = vi.fn(async () => ({ delivered: true }));

    await expect(
      createOrProvisionOrganizationUser(
        {
          orgId: 'org-1',
          email: 'fail@user.com',
          firstName: 'Fail',
          lastName: 'Profile',
          membershipRole: 'member',
        },
        { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
      ),
    ).rejects.toMatchObject({ stage: 'profile_upsert' });
  });

  it('fails when membership upsert fails', async () => {
    const { supabase } = createMockSupabase({ membershipUpsertError: { message: 'membership failed' } });
    const sendEmail = vi.fn(async () => ({ delivered: true }));

    await expect(
      createOrProvisionOrganizationUser(
        {
          orgId: 'org-1',
          email: 'fail@membership.com',
          firstName: 'Fail',
          lastName: 'Membership',
          membershipRole: 'member',
        },
        { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
      ),
    ).rejects.toMatchObject({ stage: 'membership_upsert' });
  });

  it('fails when setup link generation fails', async () => {
    const { supabase } = createMockSupabase({ setupLink: '' });
    const sendEmail = vi.fn(async () => ({ delivered: true }));

    await expect(
      createOrProvisionOrganizationUser(
        {
          orgId: 'org-1',
          email: 'fail@link.com',
          firstName: 'Fail',
          lastName: 'Link',
          membershipRole: 'member',
        },
        { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
      ),
    ).rejects.toMatchObject({ stage: 'setup_link_generate' });
  });

  it('returns setup link even when email delivery fails', async () => {
    const { supabase } = createMockSupabase();
    const sendEmail = vi.fn(async () => ({ delivered: false, reason: 'smtp_not_configured' }));

    const result = await createOrProvisionOrganizationUser(
      {
        orgId: 'org-1',
        email: 'noemail@user.com',
        firstName: 'No',
        lastName: 'Email',
        membershipRole: 'member',
      },
      { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
    );

    expect(result.setupLink).toContain('https://setup.link');
    expect(result.emailSent).toBe(false);
  });

  it('rejects invalid emails during validation', async () => {
    const { supabase } = createMockSupabase();
    const sendEmail = vi.fn(async () => ({ delivered: true }));

    await expect(
      createOrProvisionOrganizationUser(
        {
          orgId: 'org-1',
          email: 'invalid-email',
          firstName: 'Bad',
          lastName: 'Email',
          membershipRole: 'member',
        },
        { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
      ),
    ).rejects.toMatchObject({ stage: 'validate_input', code: 'invalid_email' });
  });

  it('rejects short passwords during validation', async () => {
    const { supabase } = createMockSupabase();
    const sendEmail = vi.fn(async () => ({ delivered: true }));

    await expect(
      createOrProvisionOrganizationUser(
        {
          orgId: 'org-1',
          email: 'short@pw.com',
          firstName: 'Short',
          lastName: 'Password',
          membershipRole: 'member',
          password: 'short',
        },
        { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
      ),
    ).rejects.toMatchObject({ stage: 'validate_input', code: 'invalid_password' });
  });

  it('fails when admin role mapping cannot be created', async () => {
    const { supabase } = createMockSupabase({ adminUpsertError: { message: 'admin failed' } });
    const sendEmail = vi.fn(async () => ({ delivered: true }));

    await expect(
      createOrProvisionOrganizationUser(
        {
          orgId: 'org-1',
          email: 'admin@user.com',
          firstName: 'Admin',
          lastName: 'User',
          membershipRole: 'admin',
        },
        { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
      ),
    ).rejects.toMatchObject({ stage: 'admin_role_upsert' });
  });

  it('fails when profile verification is missing', async () => {
    const { supabase } = createMockSupabase({ skipProfileStore: true });
    const sendEmail = vi.fn(async () => ({ delivered: true }));

    await expect(
      createOrProvisionOrganizationUser(
        {
          orgId: 'org-1',
          email: 'missing@profile.com',
          firstName: 'Missing',
          lastName: 'Profile',
          membershipRole: 'member',
        },
        { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
      ),
    ).rejects.toMatchObject({ stage: 'profile_upsert', code: 'profile_not_found' });
  });

  it('fails when membership verification is missing', async () => {
    const { supabase } = createMockSupabase({ skipMembershipStore: true });
    const sendEmail = vi.fn(async () => ({ delivered: true }));

    await expect(
      createOrProvisionOrganizationUser(
        {
          orgId: 'org-1',
          email: 'missing@membership.com',
          firstName: 'Missing',
          lastName: 'Membership',
          membershipRole: 'member',
        },
        { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
      ),
    ).rejects.toMatchObject({ stage: 'membership_upsert', code: 'membership_not_found' });
  });

  it('remains idempotent when provisioning the same user twice', async () => {
    const { supabase, store } = createMockSupabase();
    const sendEmail = vi.fn(async () => ({ delivered: true }));

    await createOrProvisionOrganizationUser(
      {
        orgId: 'org-1',
        email: 'idempotent@user.com',
        firstName: 'Idempotent',
        lastName: 'User',
        membershipRole: 'member',
      },
      { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
    );

    await createOrProvisionOrganizationUser(
      {
        orgId: 'org-1',
        email: 'idempotent@user.com',
        firstName: 'Idempotent',
        lastName: 'User',
        membershipRole: 'member',
      },
      { supabase, sendEmail, getOrganizationMembershipsOrgColumnName: async () => 'organization_id' },
    );

    expect(store.memberships.size).toBe(1);
  });
});
