import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveStoredCourseProgress, PROGRESS_STORAGE_KEY, type StoredCourseProgress } from '../courseProgress';

const { syncProgressSnapshotMock, isEnabledMock } = vi.hoisted(() => ({
  syncProgressSnapshotMock: vi.fn().mockResolvedValue(true),
  isEnabledMock: vi.fn(() => true),
}));

vi.mock('../../services/progressService', () => ({
  progressService: {
    isEnabled: isEnabledMock,
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
});
