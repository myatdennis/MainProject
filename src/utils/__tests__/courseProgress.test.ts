import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveStoredCourseProgress,
  syncCourseProgressWithRemote,
  loadStoredCourseProgress,
  PROGRESS_STORAGE_KEY,
  type StoredCourseProgress,
} from '../courseProgress';

const { syncProgressSnapshotMock, fetchLessonProgressMock, isEnabledMock } = vi.hoisted(() => ({
  syncProgressSnapshotMock: vi.fn().mockResolvedValue(true),
  fetchLessonProgressMock: vi.fn().mockResolvedValue([]),
  isEnabledMock: vi.fn(() => true),
}));

vi.mock('../../services/progressService', () => ({
  progressService: {
    isEnabled: isEnabledMock,
    fetchLessonProgress: fetchLessonProgressMock,
    syncProgressSnapshot: syncProgressSnapshotMock,
  },
}));

describe('courseProgress.saveStoredCourseProgress', () => {
  const storage: Record<string, string> = {};
  const localStorageMock: Storage = {
    getItem: (key: string) => (key in storage ? storage[key] : null),
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    },
    key: (index: number) => Object.keys(storage)[index] ?? null,
    get length() {
      return Object.keys(storage).length;
    },
  } as Storage;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(storage).forEach((key) => delete storage[key]);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
  });

  it('persists local lesson progress and syncs snapshot payload for remote API', async () => {
    const payload: StoredCourseProgress = {
      completedLessonIds: ['lesson-1'],
      lessonProgress: { 'lesson-1': 100 },
      lessonPositions: { 'lesson-1': 87 },
      lastLessonId: 'lesson-1',
    };

    saveStoredCourseProgress('inclusive-leadership', payload, {
      courseId: 'course-123',
      userId: 'learner@example.com',
      lessonIds: ['lesson-1', 'lesson-2'],
    });

    const stored = JSON.parse(localStorageMock.getItem(PROGRESS_STORAGE_KEY) ?? '{}');
    expect(stored['inclusive-leadership']).toMatchObject(payload);

    expect(syncProgressSnapshotMock).toHaveBeenCalledTimes(1);
    expect(syncProgressSnapshotMock).toHaveBeenCalledWith({
      userId: 'learner@example.com',
      courseId: 'course-123',
      lessonIds: ['lesson-1', 'lesson-2'],
      lessons: [
        {
          lessonId: 'lesson-1',
          progressPercent: 100,
          completed: true,
          positionSeconds: 87,
        },
      ],
      overallPercent: 50,
      completedAt: null,
      totalTimeSeconds: 87,
      lastLessonId: 'lesson-1',
    });
  });

  it('does not reset local progress when remote sync returns no rows', async () => {
    const existing: StoredCourseProgress = {
      completedLessonIds: ['lesson-a'],
      lessonProgress: { 'lesson-a': 100, 'lesson-b': 40 },
      lessonPositions: { 'lesson-a': 120, 'lesson-b': 45 },
      lastLessonId: 'lesson-a',
    };

    saveStoredCourseProgress('course-empty-remote', existing);

    fetchLessonProgressMock.mockResolvedValueOnce([]);

    const result = await syncCourseProgressWithRemote({
      courseSlug: 'course-empty-remote',
      courseId: 'course-empty-remote-id',
      userId: 'learner-1',
      lessonIds: ['lesson-a', 'lesson-b'],
    });

    expect(result).toMatchObject(existing);
    expect(loadStoredCourseProgress('course-empty-remote')).toMatchObject(existing);
  });

  it('preserves higher local progress when remote snapshot is stale', async () => {
    const existing: StoredCourseProgress = {
      completedLessonIds: ['lesson-a'],
      lessonProgress: { 'lesson-a': 100, 'lesson-b': 80 },
      lessonPositions: { 'lesson-a': 80, 'lesson-b': 60 },
      lastLessonId: 'lesson-a',
    };

    saveStoredCourseProgress('course-stale-remote', existing);

    fetchLessonProgressMock.mockResolvedValueOnce([
      {
        lesson_id: 'lesson-a',
        progress_percentage: 0,
        completed: false,
        time_spent: 10,
        last_accessed_at: '2025-01-01T00:00:00.000Z',
      },
      {
        lesson_id: 'lesson-b',
        progress_percentage: 20,
        completed: false,
        time_spent: 15,
        last_accessed_at: '2025-01-01T00:01:00.000Z',
      },
    ]);

    const result = await syncCourseProgressWithRemote({
      courseSlug: 'course-stale-remote',
      courseId: 'course-stale-remote-id',
      userId: 'learner-2',
      lessonIds: ['lesson-a', 'lesson-b'],
    });

    expect(result?.completedLessonIds).toEqual(['lesson-a']);
    expect(result?.lessonProgress).toMatchObject({ 'lesson-a': 100, 'lesson-b': 80 });
    expect(result?.lessonPositions).toMatchObject({ 'lesson-a': 80, 'lesson-b': 60 });
    expect(loadStoredCourseProgress('course-stale-remote').lessonProgress).toMatchObject({
      'lesson-a': 100,
      'lesson-b': 80,
    });
  });

  it('maps remote progress onto requested lesson id when remote ids do not overlap', async () => {
    fetchLessonProgressMock.mockResolvedValueOnce([
      {
        lesson_id: 'server-row-lesson-uuid',
        progress_percentage: 100,
        completed: true,
        time_spent: 120,
        last_accessed_at: '2025-01-01T00:02:00.000Z',
      },
    ]);

    const result = await syncCourseProgressWithRemote({
      courseSlug: 'course-id-mismatch',
      courseId: 'course-id-mismatch-id',
      userId: 'learner-3',
      lessonIds: ['client-lesson-id'],
    });

    expect(result?.lessonProgress).toMatchObject({ 'client-lesson-id': 100 });
    expect(result?.completedLessonIds).toEqual(['client-lesson-id']);
    expect(result?.lessonPositions).toMatchObject({ 'client-lesson-id': 120 });
    expect(result?.lastLessonId).toBe('client-lesson-id');
    expect(loadStoredCourseProgress('course-id-mismatch').lessonProgress).toMatchObject({
      'client-lesson-id': 100,
    });
  });
});
