import { describe, expect, it } from 'vitest';
import { assertAdminQueryColumns } from '../utils/adminSchemaGuard.js';

describe('admin schema guard', () => {
  it('throws for known invalid user_profiles columns in development', () => {
    expect(() =>
      assertAdminQueryColumns({
        table: 'user_profiles',
        columns: ['id', 'status', 'email'],
        label: 'test.user_profiles',
      }),
    ).toThrow(/invalid user_profiles column\(s\): status/i);
  });

  it('throws for known invalid survey_assignments columns in development', () => {
    expect(() =>
      assertAdminQueryColumns({
        table: 'survey_assignments',
        columns: 'survey_id,organization_id,user_ids',
        label: 'test.survey_assignments',
      }),
    ).toThrow(/invalid survey_assignments column\(s\): organization_id/i);
  });

  it('allows valid admin columns', () => {
    expect(() =>
      assertAdminQueryColumns({
        table: 'survey_assignments',
        columns: 'survey_id,organization_ids,user_ids',
        label: 'test.valid',
      }),
    ).not.toThrow();
  });
});
