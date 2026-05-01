import { describe, it, expect, vi } from 'vitest';
import * as adminUsers from '../routes/admin-users.js';

const buildSupabaseClient = (options: { orgIds?: string[]; courses?: Array<{ id: string; organization_id: string }> }) => {
  const orgIds = options.orgIds ?? [];
  const courses = options.courses ?? [];
  return {
    from: (table: string) => {
      if (table === 'organizations') {
        return {
          select: () => ({
            in: async (_col: string, ids: string[]) => ({
              data: orgIds.filter((id) => ids.includes(id)).map((id) => ({ id })),
              error: null,
            }),
          }),
        };
      }
      if (table === 'courses') {
        return {
          select: () => ({
            in: async (_col: string, ids: string[]) => ({
              data: courses.filter((row) => ids.includes(row.id)),
              error: null,
            }),
          }),
        };
      }
      return {
        select: () => ({ in: async () => ({ data: [], error: null }) }),
      };
    },
  } as any;
};

describe('admin user CSV import', () => {
  it('imports valid CSV rows', async () => {
    const csv = 'email,first_name,last_name,organization_id,role\nuser@example.com,Jane,Doe,org-1,member';
    const rows = (adminUsers as any).parseCsvText(csv);
    const provisionUser = vi.fn().mockResolvedValue({
      email: 'user@example.com',
      userId: 'user-1',
      orgId: 'org-1',
      created: true,
      membershipCreated: true,
      setupLink: 'link',
      emailSent: true,
    });

    const { results } = await (adminUsers as any).processUserImportRows({
      rows,
      actorUserId: 'admin-1',
      defaultOrgId: null,
      requestId: 'req-1',
      deps: {
        supabaseClient: buildSupabaseClient({ orgIds: ['org-1'] }),
        provisionUser,
        assignCourses: vi.fn(),
      },
    });

    expect(results[0]).toMatchObject({
      email: 'user@example.com',
      organizationId: 'org-1',
      status: 'created',
    });
    expect(provisionUser).toHaveBeenCalledTimes(1);
  });

  it('marks duplicate rows as failed', async () => {
    const rows = [
      { email: 'dup@example.com', first_name: 'A', last_name: 'B', organization_id: 'org-1', role: 'member' },
      { email: 'dup@example.com', first_name: 'A', last_name: 'B', organization_id: 'org-1', role: 'member' },
    ];

    const provisionUser = vi.fn().mockResolvedValue({
      email: 'dup@example.com',
      userId: 'user-dup',
      orgId: 'org-1',
      created: true,
      membershipCreated: true,
      setupLink: 'link',
      emailSent: true,
    });

    const { results } = await (adminUsers as any).processUserImportRows({
      rows,
      actorUserId: 'admin-1',
      defaultOrgId: null,
      requestId: 'req-2',
      deps: {
        supabaseClient: buildSupabaseClient({ orgIds: ['org-1'] }),
        provisionUser,
        assignCourses: vi.fn(),
      },
    });

    expect(results[0].status).toBe('created');
    expect(results[1].status).toBe('failed');
  });

  it('reuses existing users as skipped', async () => {
    const rows = [
      { email: 'existing@example.com', first_name: 'E', last_name: 'User', organization_id: 'org-1', role: 'member' },
    ];
    const provisionUser = vi.fn().mockResolvedValue({
      email: 'existing@example.com',
      userId: 'user-2',
      orgId: 'org-1',
      created: false,
      membershipCreated: false,
      setupLink: null,
      emailSent: false,
    });

    const { results } = await (adminUsers as any).processUserImportRows({
      rows,
      actorUserId: 'admin-1',
      defaultOrgId: null,
      requestId: 'req-3',
      deps: {
        supabaseClient: buildSupabaseClient({ orgIds: ['org-1'] }),
        provisionUser,
        assignCourses: vi.fn(),
      },
    });

    expect(results[0].status).toBe('skipped');
  });

  it('handles mixed success and failure rows', async () => {
    const rows = [
      { email: 'ok@example.com', first_name: 'Ok', last_name: 'User', organization_id: 'org-1', role: 'member' },
      { email: 'bad@example.com', first_name: 'Bad', last_name: 'User', organization_id: 'missing-org', role: 'member' },
    ];

    const { results } = await (adminUsers as any).processUserImportRows({
      rows,
      actorUserId: 'admin-1',
      defaultOrgId: null,
      requestId: 'req-4',
      deps: {
        supabaseClient: buildSupabaseClient({ orgIds: ['org-1'] }),
        provisionUser: vi.fn().mockResolvedValue({
          email: 'ok@example.com',
          userId: 'user-3',
          orgId: 'org-1',
          created: true,
          membershipCreated: true,
          setupLink: 'link',
          emailSent: true,
        }),
        assignCourses: vi.fn(),
      },
    });

    expect(results[0].status).toBe('created');
    expect(results[1].status).toBe('failed');
  });

  it('assigns course ids when provided', async () => {
    const rows = [
      {
        email: 'course@example.com',
        first_name: 'Course',
        last_name: 'User',
        organization_id: 'org-1',
        role: 'member',
        course_ids: 'course-1|course-2',
      },
    ];
    const assignCourses = vi.fn();
    const provisionUser = vi.fn().mockResolvedValue({
      email: 'course@example.com',
      userId: 'user-4',
      orgId: 'org-1',
      created: true,
      membershipCreated: true,
      setupLink: 'link',
      emailSent: true,
    });

    const { results } = await (adminUsers as any).processUserImportRows({
      rows,
      actorUserId: 'admin-1',
      defaultOrgId: null,
      requestId: 'req-5',
      deps: {
        supabaseClient: buildSupabaseClient({
          orgIds: ['org-1'],
          courses: [
            { id: 'course-1', organization_id: 'org-1' },
            { id: 'course-2', organization_id: 'org-1' },
          ],
        }),
        provisionUser,
        assignCourses,
      },
    });

    expect(results[0].status).toBe('created');
    expect(assignCourses).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-4',
      courseIds: ['course-1', 'course-2'],
      actorUserId: 'admin-1',
    });
  });
});
