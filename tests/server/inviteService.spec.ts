import { describe, it, expect, vi } from 'vitest';

// Mock the server supabase client used by admin-users route
vi.mock('../../server/lib/supabaseClient.js', () => {
  // A minimal chainable supabase.from(...) mock used by createInviteFallback
  const fakeFrom = (table: any) => {
    return {
      select: (_sel: any, _opts: any) => ({
        eq: (_col: any, _val: any) => ({
          in: (_col2: any, _vals: any) => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      insert: (candidate: any) => ({
        select: () => ({ single: async () => ({ data: { id: 'inv-1', email: candidate.email }, error: null }) }),
      }),
    };
  };
  return { default: { from: fakeFrom } };
});

import * as adminUsers from '../../server/routes/admin-users.js';

describe('invite flow (mocked supabase)', () => {
  it('createInviteFallback inserts invite when none exists', async () => {
    const result = await (adminUsers as any).createInviteFallback({ orgId: 'org-1', email: 'x@example.com', role: 'member' });
    expect(result).toHaveProperty('id', 'inv-1');
    expect(result).toHaveProperty('duplicate', false);
  });
});
