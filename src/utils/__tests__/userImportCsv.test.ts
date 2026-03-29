import { describe, it, expect } from 'vitest';
import {
  buildFailedRowsCsv,
  buildResultsCsv,
  normalizeUserImportRows,
  parseUserImportCsv,
  validateUserImportRows,
} from '../userImportCsv';

describe('user import CSV utilities', () => {
  it('builds a results CSV', () => {
    const csv = buildResultsCsv([
      {
        email: 'user@example.com',
        status: 'created',
        message: 'user created',
        userId: 'user-1',
        organizationId: 'org-1',
        emailSent: true,
        setupLinkPresent: true,
      },
    ]);

    expect(csv.split('\n')[0]).toBe('email,status,message,userId,organizationId,emailSent,setupLinkPresent');
    expect(csv).toContain('user@example.com');
  });

  it('builds a failed rows CSV', () => {
    const raw = parseUserImportCsv('email,organization_id,role\nfail@example.com,org-1,member');
    const rows = normalizeUserImportRows(raw);
    const issues = validateUserImportRows(rows, { validOrgIds: new Set(['org-1']), validRoles: new Set(['member']) });
    const failedCsv = buildFailedRowsCsv(rows, issues);

    expect(failedCsv.split('\n')[0]).toContain('error');
  });
});
