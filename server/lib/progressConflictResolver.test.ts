import { describe, expect, it, vi } from 'vitest';
import {
  buildCourseProgressConflictTargets,
  buildLessonProgressConflictTargets,
  isConflictConstraintMissing,
  upsertWithConflictFallback,
} from './progressConflictResolver.js';

describe('progressConflictResolver', () => {
  it('detects conflict-target mismatch errors', () => {
    expect(isConflictConstraintMissing({ code: '42P10', message: 'no unique or exclusion constraint matching the ON CONFLICT specification' })).toBe(true);
    expect(isConflictConstraintMissing({ message: 'some other db error' })).toBe(false);
  });

  it('builds lesson conflict targets with org/course variants', () => {
    expect(
      buildLessonProgressConflictTargets({ includeCourseId: true, includeOrgScope: true, orgColumn: 'organization_id' }),
    ).toEqual([
      'user_id,lesson_id',
      'user_id,course_id,lesson_id',
      'user_id,organization_id,lesson_id',
      'user_id,organization_id,course_id,lesson_id',
    ]);
  });

  it('builds course conflict targets with uuid and org fallbacks', () => {
    expect(
      buildCourseProgressConflictTargets({ includeUserIdUuid: true, includeOrgScope: true, orgColumn: 'organization_id' }),
    ).toEqual([
      'user_id_uuid,course_id',
      'user_id_uuid,organization_id,course_id',
      'user_id,course_id',
      'user_id,organization_id,course_id',
    ]);
  });

  it('retries with next conflict target and succeeds', async () => {
    const warn = vi.fn();
    const select = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: '42P10',
          message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
        },
      })
      .mockResolvedValueOnce({ data: [{ id: 'row-1' }], error: null });

    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ upsert }));

    const result = await upsertWithConflictFallback({
      supabase: { from } as any,
      table: 'user_lesson_progress',
      payload: [{ id: 'row-1' }],
      conflictTargets: ['user_id,lesson_id', 'user_id,course_id,lesson_id'],
      logger: { warn },
      context: {
        requestId: 'req-1',
        userId: 'user-1',
        orgId: 'org-1',
        failingFunction: 'test.case',
      },
    });

    expect(result.data).toEqual([{ id: 'row-1' }]);
    expect(result.conflictTarget).toBe('user_id,course_id,lesson_id');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});
