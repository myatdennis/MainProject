import { describe, expect, it } from 'vitest';
import { buildOrgInviteInsertAttemptPayloads } from '../../utils/orgInvites.js';

describe('org invite insert attempt payloads', () => {
  it('prefers the detected invite_token column without sending token first', () => {
    const attempts = buildOrgInviteInsertAttemptPayloads({
      orgColumn: 'organization_id',
      tokenColumn: 'invite_token',
      orgId: 'org-1',
      token: 'abc123',
      basePayload: { email: 'user@example.com', role: 'member' },
    });

    expect(attempts).toEqual([
      {
        email: 'user@example.com',
        role: 'member',
        organization_id: 'org-1',
        invite_token: 'abc123',
      },
      {
        email: 'user@example.com',
        role: 'member',
        organization_id: 'org-1',
      },
    ]);
  });

  it('prefers the detected token column without sending invite_token first', () => {
    const attempts = buildOrgInviteInsertAttemptPayloads({
      orgColumn: 'org_id',
      tokenColumn: 'token',
      orgId: 'org-1',
      token: 'abc123',
      basePayload: { email: 'user@example.com', role: 'member' },
    });

    expect(attempts).toEqual([
      {
        email: 'user@example.com',
        role: 'member',
        org_id: 'org-1',
        token: 'abc123',
      },
      {
        email: 'user@example.com',
        role: 'member',
        org_id: 'org-1',
      },
    ]);
  });
});
