import { describe, expect, it } from 'vitest';
import {
  buildSnapshotSeedKey,
  createSnapshotSeedAttemptCache,
  normalizeSnapshotLessonIds,
} from './learnerProgressHotPath.js';

describe('learnerProgressHotPath', () => {
  it('builds stable seed cache keys by user/org/course', () => {
    expect(
      buildSnapshotSeedKey({ userId: 'User-1', orgId: 'Org-9', courseId: 'Course-2' }),
    ).toBe('user-1::org-9::course-2');
  });

  it('prevents repeated seed attempts inside TTL window', () => {
    const cache = createSnapshotSeedAttemptCache({ ttlMs: 10_000 });
    const key = 'u::o::c';

    expect(cache.shouldAttempt(key, 1000)).toBe(true);
    cache.markAttempt(key, 1000);
    expect(cache.shouldAttempt(key, 5000)).toBe(false);
    expect(cache.shouldAttempt(key, 11001)).toBe(true);
  });

  it('normalizes lesson ids from lessonIds/lesson_ids first, then lesson objects', () => {
    const parseLessonIdsParam = (raw: unknown) => {
      if (!raw) return [] as string[];
      return String(raw)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    };
    const coerceString = (...values: unknown[]) => {
      const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
      return typeof found === 'string' ? found : null;
    };

    const direct = normalizeSnapshotLessonIds(
      { lessonIds: 'l1,l2,l2', lessons: [{ lessonId: 'ignored-1' }] },
      parseLessonIdsParam,
      coerceString,
    );
    expect(direct).toEqual(['l1', 'l2']);

    const fallback = normalizeSnapshotLessonIds(
      { lessons: [{ lessonId: 'a' }, { lesson_id: 'b' }, { id: 'b' }] },
      parseLessonIdsParam,
      coerceString,
    );
    expect(fallback).toEqual(['a', 'b']);
  });
});
