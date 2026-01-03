import { test, expect } from '@playwright/test';
import { getApiBaseUrl } from './helpers/env';

const apiBase = getApiBaseUrl();

const adminHeaders = {
  'Content-Type': 'application/json',
  'x-user-role': 'admin',
};

test.describe('Admin courses with quiz + video content', () => {
  test('video + quiz lessons persist through admin save → publish → client fetch', async ({ request }) => {
    const courseTitle = `Video Quiz Course ${Date.now()}`;
    const videoLessonId = `lesson-video-${Date.now()}`;
    const quizLessonId = `lesson-quiz-${Date.now()}`;

    const createRes = await request.post(`${apiBase}/api/admin/courses`, {
      headers: adminHeaders,
      data: {
        course: {
          title: courseTitle,
          description: 'E2E test for video + quiz content',
          status: 'draft',
          version: 1,
        },
        modules: [
          {
            title: 'Module 1',
            order_index: 0,
            lessons: [
              {
                id: videoLessonId,
                type: 'video',
                title: 'Lesson with video',
                order_index: 0,
                content_json: {
                  type: 'video',
                  body: {
                    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    transcript: 'Sample transcript',
                  },
                },
              },
              {
                id: quizLessonId,
                type: 'quiz',
                title: 'Lesson with quiz',
                order_index: 1,
                content_json: {
                  type: 'quiz',
                  body: {
                    passingScore: 70,
                    questions: [
                      {
                        id: 'q1',
                        text: 'What is 2 + 2?',
                        options: ['3', '4', '5'],
                        correctAnswerIndex: 1,
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    });

    expect(createRes.ok()).toBeTruthy();
    const createdBody = await createRes.json();
    const courseId = createdBody?.data?.id;
    expect(courseId).toBeTruthy();

    const publishRes = await request.post(`${apiBase}/api/admin/courses/${courseId}/publish`, {
      headers: adminHeaders,
      data: {},
    });
    expect(publishRes.ok()).toBeTruthy();

    const clientRes = await request.get(`${apiBase}/api/client/courses/${courseId}?includeDrafts=true`);
    expect(clientRes.ok()).toBeTruthy();
    const clientBody = await clientRes.json();
    const course = clientBody?.data;
    expect(course?.title).toBe(courseTitle);

    const allLessons = (course?.modules || []).flatMap((m: any) => m.lessons || []);
    const videoLesson = allLessons.find((lesson: any) => lesson.id === videoLessonId);
    const quizLesson = allLessons.find((lesson: any) => lesson.id === quizLessonId);

    expect(videoLesson?.content?.videoUrl || videoLesson?.content?.video?.url).toContain('BigBuckBunny');
    expect(Array.isArray(quizLesson?.content?.questions)).toBe(true);
    const firstQuestion = quizLesson?.content?.questions?.[0];
    expect(firstQuestion?.options?.length).toBeGreaterThan(0);
    const correctOption = firstQuestion?.options?.find((opt: any) => opt.correct || opt.isCorrect);
    expect(correctOption?.id).toBeTruthy();

    await request.delete(`${apiBase}/api/admin/courses/${courseId}`, {
      headers: adminHeaders,
    });
  });
});
