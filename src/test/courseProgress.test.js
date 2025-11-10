import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const STORAGE_KEY = 'lms_course_progress_v1';
const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
};
describe('courseProgress utilities', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllEnvs();
        localStorage.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('persists progress locally when remote API is disabled', async () => {
        vi.stubEnv('VITE_API_BASE_URL', '');
        const progressModule = await import('../utils/courseProgress');
        const serviceModule = await import('../services/progressService');
        const syncSpy = vi.spyOn(serviceModule.progressService, 'syncProgressSnapshot');
        const payload = {
            completedLessonIds: ['lesson-a'],
            lessonProgress: { 'lesson-a': 100 },
            lessonPositions: { 'lesson-a': 320 },
            lastLessonId: 'lesson-a',
        };
        progressModule.saveStoredCourseProgress('course-demo', payload, {
            courseId: 'course-demo',
            userId: 'user-1',
            lessonIds: ['lesson-a'],
        });
        const storedRaw = localStorage.getItem(STORAGE_KEY);
        expect(storedRaw).toBeTruthy();
        const parsed = storedRaw ? JSON.parse(storedRaw) : null;
        expect(parsed?.['course-demo']).toEqual(payload);
        expect(syncSpy).not.toHaveBeenCalled();
    });
    it('syncs progress to API when enabled', async () => {
        vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
        vi.resetModules();
        const progressModule = await import('../utils/courseProgress');
        const serviceModule = await import('../services/progressService');
        const syncSpy = vi.spyOn(serviceModule.progressService, 'syncProgressSnapshot').mockResolvedValue(true);
        const data = {
            completedLessonIds: ['lesson-1'],
            lessonProgress: { 'lesson-1': 100 },
            lessonPositions: { 'lesson-1': 420 },
            lastLessonId: 'lesson-1',
        };
        progressModule.saveStoredCourseProgress('course-remote', data, {
            courseId: 'course-remote',
            userId: 'learner-7',
            lessonIds: ['lesson-1'],
        });
        await flushPromises();
        expect(syncSpy).toHaveBeenCalledWith({
            userId: 'learner-7',
            courseId: 'course-remote',
            lessonIds: ['lesson-1'],
            lessons: [
                {
                    lessonId: 'lesson-1',
                    progressPercent: 100,
                    completed: true,
                    positionSeconds: 420,
                },
            ],
            overallPercent: 100,
            completedAt: expect.any(String),
            totalTimeSeconds: 420,
            lastLessonId: 'lesson-1',
        });
        const storedRaw = localStorage.getItem(STORAGE_KEY);
        expect(storedRaw).toBeTruthy();
    });
    it('hydrates local cache from remote rows', async () => {
        vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
        vi.resetModules();
        const progressModule = await import('../utils/courseProgress');
        const serviceModule = await import('../services/progressService');
        vi.spyOn(serviceModule.progressService, 'fetchLessonProgress').mockResolvedValue([
            {
                lesson_id: 'lesson-1',
                progress_percentage: 75,
                completed: false,
                time_spent: 180,
                last_accessed_at: new Date('2024-10-20T12:00:00Z').toISOString(),
            },
            {
                lesson_id: 'lesson-2',
                progress_percentage: 100,
                completed: true,
                time_spent: 240,
                last_accessed_at: new Date('2024-10-20T13:00:00Z').toISOString(),
            },
        ]);
        const result = await progressModule.syncCourseProgressWithRemote({
            courseSlug: 'course-remote',
            courseId: 'course-remote',
            userId: 'learner-7',
            lessonIds: ['lesson-1', 'lesson-2'],
        });
        expect(result).toEqual({
            completedLessonIds: ['lesson-2'],
            lessonProgress: {
                'lesson-1': 75,
                'lesson-2': 100,
            },
            lessonPositions: {
                'lesson-1': 180,
                'lesson-2': 240,
            },
            lastLessonId: 'lesson-2',
        });
        const storedRaw = localStorage.getItem(STORAGE_KEY);
        expect(storedRaw).toBeTruthy();
        const parsed = storedRaw ? JSON.parse(storedRaw) : null;
        expect(parsed?.['course-remote']).toEqual(result);
    });
});
