import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_TEST_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  describe.skip('Supabase RLS enforcement', () => {
    it('requires SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_KEY / SUPABASE_TEST_ANON_KEY env vars to run', () => {
      expect(true).toBe(true);
    });
  });
} else {
  type TestUser = {
    id: string;
    email: string;
    password: string;
    client: SupabaseClient;
  };

  describe('Supabase RLS enforcement', () => {
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const memberClientFactory = () =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: true },
      });

    const insertedOrgIds: string[] = [];
    const createdUsers: TestUser[] = [];

    const insertOrganization = async (name: string) => {
      const id = randomUUID();
      const { error } = await adminClient.from('organizations').insert({
        id,
        name,
        contact_email: `${id}@org.local`,
        subscription: 'standard',
      });
      if (error) throw error;
      insertedOrgIds.push(id);
      return id;
    };

    const createUserForOrg = async (orgId: string, role: 'admin' | 'member' = 'member'): Promise<TestUser> => {
      const email = `${orgId}-${role}-${Date.now()}@rls.local`;
      const password = `Pass-${Math.random().toString(36).slice(2, 12)}!`;
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data?.user) {
        throw error || new Error('Failed to create test user');
      }
      const { error: membershipError } = await adminClient.from('organization_memberships').insert({
        org_id: orgId,
        user_id: data.user.id,
        role,
      });
      if (membershipError) throw membershipError;
      const client = memberClientFactory();
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const testUser = { id: data.user.id, email, password, client };
      createdUsers.push(testUser);
      return testUser;
    };

    afterAll(async () => {
      for (const user of createdUsers) {
        try {
          await adminClient.auth.admin.deleteUser(user.id);
        } catch {}
      }
      if (insertedOrgIds.length > 0) {
        try {
          await adminClient.from('organizations').delete().in('id', insertedOrgIds);
        } catch {}
      }
    });

    describe('courses + assignments org scoping', () => {
      let orgA: string;
      let orgB: string;
      let adminUser: TestUser;
      let outsider: TestUser;
      let courseId: string;

      beforeAll(async () => {
        orgA = await insertOrganization('RLS Org A');
        orgB = await insertOrganization('RLS Org B');
        adminUser = await createUserForOrg(orgA, 'admin');
        outsider = await createUserForOrg(orgB, 'member');
        courseId = randomUUID();
        const { error } = await adminClient.from('courses').insert({
          id: courseId,
          organization_id: orgA,
          title: 'Org A Security Course',
          slug: `org-a-security-${Date.now()}`,
          status: 'published',
        });
        if (error) throw error;
        const { error: assignmentError } = await adminClient.from('assignments').insert({
          course_id: courseId,
          organization_id: orgA,
          user_id: adminUser.id,
          active: true,
        });
        if (assignmentError) throw assignmentError;
      });

      it('allows org members to read their courses but blocks other orgs', async () => {
        const { data: orgCourses, error: orgError } = await adminUser.client
          .from('courses')
          .select('id')
          .eq('id', courseId);
        expect(orgError).toBeNull();
        expect(orgCourses?.length).toBe(1);

        const { data: outsiderCourses, error: outsiderError } = await outsider.client
          .from('courses')
          .select('id')
          .eq('id', courseId);
        expect(outsiderError).toBeNull();
        expect(outsiderCourses?.length ?? 0).toBe(0);
      });

      it('prevents outsiders from reading assignments scoped to another org', async () => {
        const { data: insiderAssignments, error: insiderErr } = await adminUser.client
          .from('assignments')
          .select('id')
          .eq('course_id', courseId);
        expect(insiderErr).toBeNull();
        expect(insiderAssignments?.length).toBeGreaterThanOrEqual(1);

        const { data: outsiderAssignments, error: outsiderErr } = await outsider.client
          .from('assignments')
          .select('id')
          .eq('course_id', courseId);
        expect(outsiderErr).toBeNull();
        expect(outsiderAssignments?.length ?? 0).toBe(0);
      });
    });
  });
}
