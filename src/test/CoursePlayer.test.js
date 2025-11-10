import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));
const mockLogEvent = vi.hoisted(() => vi.fn());
vi.mock('../services/syncService', () => ({
    useSyncService: () => ({
        logEvent: mockLogEvent,
        subscribe: vi.fn(() => ({ unsubscribe: () => { } })),
    }),
}));
const mockUpdateAssignmentProgress = vi.hoisted(() => vi.fn());
vi.mock('../utils/assignmentStorage', () => ({
    updateAssignmentProgress: mockUpdateAssignmentProgress,
}));
const mockSaveStoredCourseProgress = vi.hoisted(() => vi.fn());
const mockLoadStoredCourseProgress = vi.hoisted(() => vi.fn());
const mockSyncCourseProgressWithRemote = vi.hoisted(() => vi.fn());
vi.mock('../utils/courseProgress', () => ({
    loadStoredCourseProgress: mockLoadStoredCourseProgress,
    saveStoredCourseProgress: mockSaveStoredCourseProgress,
    syncCourseProgressWithRemote: mockSyncCourseProgressWithRemote,
    buildLearnerProgressSnapshot: vi.fn(),
}));
// Hoistable mock for course loader so vi.mock factory can reference it safely
const mockLoadCourse = vi.hoisted(() => vi.fn());
vi.mock('../dal/courseData', () => ({
    loadCourse: (...args) => mockLoadCourse(...args),
    clearCourseCache: vi.fn(),
}));
// Mock batching service to avoid network calls during tests
vi.mock('../services/batchService', () => ({
    batchService: {
        enqueueProgress: vi.fn(),
        enqueueAnalytics: vi.fn(),
        flushProgress: vi.fn(),
        flushAnalytics: vi.fn(),
    },
}));
// IMPORTANT: import tested component AFTER all mocks to avoid hoist issues
import CoursePlayer from '../components/CoursePlayer/CoursePlayer';
const mockCourse = {
    id: 'course-1',
    slug: 'course-1',
    title: 'Test Course',
    status: 'published',
    modules: [],
    chapters: [
        {
            id: 'chapter-1',
            title: 'Chapter 1',
            order: 1,
            lessons: [
                {
                    id: 'lesson-1',
                    title: 'Lesson 1',
                    type: 'video',
                    order: 1,
                    duration: '5 min',
                    content: {
                        videoUrl: 'https://example.com/video.mp4',
                        transcript: 'Sample transcript',
                    },
                },
                {
                    id: 'lesson-2',
                    title: 'Lesson 2',
                    type: 'text',
                    order: 2,
                    duration: '7 min',
                    content: {
                        textContent: '<p>Lesson content</p>',
                    },
                },
            ],
        },
    ],
};
const mockLessons = mockCourse.chapters[0].lessons;
const mockLoadCourseResult = {
    course: mockCourse,
    modules: [],
    lessons: mockLessons,
    source: 'supabase',
};
const renderCoursePlayer = () => {
    const queryClient = new QueryClient();
    return render(_jsx(QueryClientProvider, { client: queryClient, children: _jsx(MemoryRouter, { initialEntries: ['/lms/course/course-1/lesson/lesson-1'], children: _jsx(Routes, { children: _jsx(Route, { path: "/lms/course/:courseId/lesson/:lessonId", element: _jsx(CoursePlayer, { namespace: "admin" }) }) }) }) }));
};
describe('CoursePlayer progress integration', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockLoadCourse.mockResolvedValue(mockLoadCourseResult);
        mockLoadStoredCourseProgress.mockReturnValue({
            completedLessonIds: [],
            lessonProgress: {},
            lessonPositions: {},
        });
        mockSyncCourseProgressWithRemote.mockResolvedValue(null);
        mockUpdateAssignmentProgress.mockResolvedValue(undefined);
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
    it('syncs remote progress on mount and hydrates stored progress', async () => {
        renderCoursePlayer();
        await waitFor(() => {
            expect(mockLoadCourse).toHaveBeenCalledWith('course-1', { includeDrafts: false, preferRemote: true });
            expect(mockSyncCourseProgressWithRemote).toHaveBeenCalled();
        });
        const syncArgs = mockSyncCourseProgressWithRemote.mock.calls[0][0];
        expect(syncArgs).toEqual({
            courseSlug: 'course-1',
            courseId: 'course-1',
            userId: 'local-user',
            lessonIds: ['lesson-1', 'lesson-2'],
        });
        expect(mockLoadStoredCourseProgress).toHaveBeenCalledWith('course-1');
    });
    it('persists progress and updates assignment when marking lesson complete', async () => {
        renderCoursePlayer();
        const markButtons = await screen.findAllByRole('button', { name: /Mark as complete/i });
        await userEvent.click(markButtons[0]);
        await waitFor(() => {
            expect(mockSaveStoredCourseProgress).toHaveBeenCalled();
            expect(mockUpdateAssignmentProgress).toHaveBeenCalled();
        });
        const savedPayloads = mockSaveStoredCourseProgress.mock.calls
            .filter((call) => call[0] === 'course-1')
            .map((call) => call[1]);
        expect(savedPayloads).toEqual(expect.arrayContaining([
            expect.objectContaining({
                completedLessonIds: expect.arrayContaining(['lesson-1']),
                lessonProgress: expect.objectContaining({ 'lesson-1': 100 }),
            }),
        ]));
        expect(mockUpdateAssignmentProgress).toHaveBeenCalledWith('course-1', 'local-user', expect.any(Number));
        expect(mockLogEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'user_completed' }));
    });
    it('records partial progress during video playback', async () => {
        renderCoursePlayer();
        const video = await waitFor(() => {
            const element = document.querySelector('video');
            if (!element) {
                throw new Error('Video element not rendered yet');
            }
            return element;
        });
        expect(video).toBeTruthy();
        Object.defineProperty(video, 'duration', { value: 100, configurable: true });
        video.currentTime = 40;
        fireEvent.timeUpdate(video);
        await waitFor(() => {
            expect(mockUpdateAssignmentProgress).toHaveBeenCalledWith('course-1', 'local-user', expect.any(Number));
            expect(mockSaveStoredCourseProgress).toHaveBeenCalled();
            expect(mockLogEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'user_progress' }));
        });
    });
});
