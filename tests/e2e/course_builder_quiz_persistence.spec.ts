import { test, expect } from '@playwright/test';
import { getApiBaseUrl } from './helpers/env';

const apiBase = getApiBaseUrl();

const headers = {
  'content-type': 'application/json',
  'x-user-role': 'admin',
  'x-e2e-bypass': 'true',
};

test.describe('Course Builder quiz answer persistence', () => {
  test('persists selected correct answer through course save pipeline', async ({ request }) => {
    const unique = Date.now();
    const moduleId = `mod-${unique}`;
    const lessonId = `lesson-${unique}`;
    const questionId = `q-${unique}`;

    const createRes = await request.post(`${apiBase}/api/admin/courses`, {
      failOnStatusCode: false,
      headers,
      data: {
        course: {
          title: `Quiz Persistence Course ${unique}`,
          description: 'Regression test for quiz correct answer persistence in save pipeline.',
          organization_id: 'demo-sandbox-org',
        },
        modules: [
          {
            id: moduleId,
            title: 'Module 1',
            order_index: 1,
            lessons: [
              {
                id: lessonId,
                title: 'Quiz Lesson',
                type: 'quiz',
                order_index: 1,
                content: {
                  passingScore: 80,
                  questions: [
                    {
                      id: questionId,
                      text: 'Which option should be correct?',
                      options: ['Option A', 'Option B'],
                      correctAnswerIndex: 0,
                      explanation: '',
                    },
                  ],
                },
                content_json: {
                  passingScore: 80,
                  questions: [
                    {
                      id: questionId,
                      text: 'Which option should be correct?',
                      options: ['Option A', 'Option B'],
                      correctAnswerIndex: 0,
                      explanation: '',
                    },
                  ],
                },
              },
            ],
          },
        ],
        idempotency_key: `course.save:quiz-create:${unique}`,
        action: 'course.save',
      },
    });

    const createBody = await createRes.text();
    expect(createRes.status(), createBody).toBe(201);
    const created = JSON.parse(createBody)?.data;
    expect(created?.id).toBeTruthy();

    const courseId = created.id as string;
    const version = typeof created.version === 'number' ? created.version : 1;

    const updateRes = await request.post(`${apiBase}/api/admin/courses`, {
      failOnStatusCode: false,
      headers,
      data: {
        course: {
          id: courseId,
          version,
          title: created.title,
          description: created.description,
          organization_id: 'demo-sandbox-org',
        },
        modules: [
          {
            id: moduleId,
            title: 'Module 1',
            order_index: 1,
            lessons: [
              {
                id: lessonId,
                title: 'Quiz Lesson',
                type: 'quiz',
                order_index: 1,
                content: {
                  passingScore: 80,
                  questions: [
                    {
                      id: questionId,
                      text: 'Which option should be correct?',
                      options: [
                        { id: `${questionId}-opt-0`, text: 'Option A', correct: false, isCorrect: false },
                        { id: `${questionId}-opt-1`, text: 'Option B', correct: true, isCorrect: true },
                      ],
                      correctAnswerIndex: 1,
                      correctAnswer: `${questionId}-opt-1`,
                      explanation: '',
                    },
                  ],
                },
                content_json: {
                  passingScore: 80,
                  questions: [
                    {
                      id: questionId,
                      text: 'Which option should be correct?',
                      options: [
                        { id: `${questionId}-opt-0`, text: 'Option A', correct: false, isCorrect: false },
                        { id: `${questionId}-opt-1`, text: 'Option B', correct: true, isCorrect: true },
                      ],
                      correctAnswerIndex: 1,
                      correctAnswer: `${questionId}-opt-1`,
                      explanation: '',
                    },
                  ],
                },
              },
            ],
          },
        ],
        idempotency_key: `course.save:quiz-update:${unique}`,
        action: 'course.save',
      },
    });

    const updateBody = await updateRes.text();
    expect([200, 201], updateBody).toContain(updateRes.status());

    const fetchRes = await request.get(
      `${apiBase}/api/admin/courses/${encodeURIComponent(courseId)}?includeStructure=true&includeLessons=true`,
      {
        failOnStatusCode: false,
        headers,
      },
    );

    const fetchBody = await fetchRes.text();
    expect(fetchRes.status(), fetchBody).toBe(200);
    const fetchedCourse = JSON.parse(fetchBody)?.data;

    const fetchedLessons = Array.isArray(fetchedCourse?.modules)
      ? fetchedCourse.modules.flatMap((module: any) => (Array.isArray(module?.lessons) ? module.lessons : []))
      : [];
    const fetchedLesson = fetchedLessons.find((lesson: any) => lesson?.id === lessonId) ||
      fetchedLessons.find((lesson: any) => lesson?.type === 'quiz');
    const fetchedLessonContent =
      (fetchedLesson?.content && typeof fetchedLesson.content === 'object' ? fetchedLesson.content : null) ||
      (fetchedLesson?.content_json && typeof fetchedLesson.content_json === 'object' ? fetchedLesson.content_json : null);
    const fetchedQuestion = fetchedLessonContent?.questions?.[0] ?? null;
    const fetchedOptions = Array.isArray(fetchedQuestion?.options) ? fetchedQuestion.options : [];
    expect(fetchedLesson, 'Expected a persisted quiz lesson in fetched course structure').toBeTruthy();
    expect(fetchedQuestion, 'Expected a persisted quiz question in fetched lesson content').toBeTruthy();
    const resolvedCorrectIndex =
      typeof fetchedQuestion?.correctAnswerIndex === 'number'
        ? fetchedQuestion.correctAnswerIndex
        : fetchedOptions.findIndex(
            (option: any) =>
              Boolean(option?.correct || option?.isCorrect) ||
              (fetchedQuestion?.correctAnswer && option?.id === fetchedQuestion.correctAnswer),
          );

    expect(resolvedCorrectIndex).toBe(1);
    expect(Boolean(fetchedOptions[1]?.correct || fetchedOptions[1]?.isCorrect)).toBe(true);
    expect(Boolean(fetchedOptions[0]?.correct || fetchedOptions[0]?.isCorrect)).toBe(false);
  });
});
