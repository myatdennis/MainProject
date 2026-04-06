import { describe, expect, it } from 'vitest';
import { deriveSurveyAssignmentOrgScope } from '../../server/utils/surveyAssignmentOrgScope.js';

describe('survey assignment organization scope derivation', () => {
  it('derives a single organization when each targeted user has one active membership', () => {
    const result = deriveSurveyAssignmentOrgScope({
      normalizedUserIds: ['user-1'],
      membershipRows: [
        {
          user_id: 'user-1',
          organization_id: 'org-1',
          status: 'active',
          is_active: true,
          accepted_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(result).toEqual({ ok: true, organizationIds: ['org-1'] });
  });

  it('returns organization_scope_required when a targeted user has no active membership', () => {
    const result = deriveSurveyAssignmentOrgScope({
      normalizedUserIds: ['user-2'],
      membershipRows: [],
    });

    expect(result).toEqual({
      ok: false,
      code: 'organization_scope_required',
      message:
        'One or more target users are missing an active organization membership. Provide organizationIds explicitly.',
      meta: {
        unresolvedUsers: ['user-2'],
      },
    });
  });

  it('returns explicit_org_selection_required when a targeted user has memberships in multiple orgs', () => {
    const result = deriveSurveyAssignmentOrgScope({
      normalizedUserIds: ['user-3'],
      membershipRows: [
        {
          user_id: 'user-3',
          organization_id: 'org-a',
          status: 'active',
          is_active: true,
          accepted_at: '2026-01-01T00:00:00.000Z',
        },
        {
          user_id: 'user-3',
          organization_id: 'org-b',
          status: 'active',
          is_active: true,
          accepted_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      code: 'explicit_org_selection_required',
      message:
        'One or more target users belong to multiple organizations. Provide organizationIds explicitly.',
      meta: {
        ambiguousUsers: ['user-3'],
      },
    });
  });

  it('ignores inactive or unaccepted memberships while deriving scope', () => {
    const result = deriveSurveyAssignmentOrgScope({
      normalizedUserIds: ['user-4'],
      membershipRows: [
        {
          user_id: 'user-4',
          organization_id: 'org-inactive',
          status: 'inactive',
          is_active: true,
          accepted_at: '2026-01-01T00:00:00.000Z',
        },
        {
          user_id: 'user-4',
          organization_id: 'org-not-accepted',
          status: 'active',
          is_active: true,
          accepted_at: null,
        },
        {
          user_id: 'user-4',
          organization_id: 'org-active',
          status: 'active',
          is_active: true,
          accepted_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(result).toEqual({ ok: true, organizationIds: ['org-active'] });
  });
});
