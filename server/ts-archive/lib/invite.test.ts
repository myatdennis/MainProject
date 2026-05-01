import { describe, it, expect } from 'vitest';
import * as adminUsers from '../routes/admin-users.js';

describe('invite validation', () => {
  it('createInviteFallback throws org_id_required when orgId is missing', async () => {
    await expect(async () => {
      await (adminUsers as any).createInviteFallback({ orgId: null as any, email: 'x@example.com', role: 'member' });
    }).rejects.toHaveProperty('code', 'org_id_required');
  });

  it('provisionImportedUser throws org_id_required for imported user without org', async () => {
    await expect(async () => {
      await (adminUsers as any).provisionImportedUser({}, null as any, '');
    }).rejects.toHaveProperty('code', 'org_id_required');
  });
});
