import { describe, expect, it } from 'vitest';
import { validateCoursePayload } from '../../../server/validators/coursePayload.js';

describe('validateCoursePayload', () => {
  it('allows draft quiz lessons without questions during payload validation', () => {
    const payload = {
      course: {
        title: 'Draft Quiz Course',
        description: 'Draft courses can keep incomplete quizzes while editing',
        status: 'draft',
      },
      modules: [
        {
          title: 'Module 1',
          order_index: 1,
          lessons: [
            {
              title: 'Quiz Lesson',
              type: 'quiz',
              order_index: 1,
              content_json: {
                type: 'quiz',
                body: {},
              },
            },
          ],
        },
      ],
    };

    const result = validateCoursePayload(payload);
    expect(result.ok).toBe(true);
  });

  it('allows published quiz lessons without questions during normal payload validation', () => {
    const payload = {
      course: {
        title: 'Published Quiz Course',
        description: 'Published courses can still be saved while quiz content is in-progress',
        status: 'published',
      },
      modules: [
        {
          title: 'Module 1',
          order_index: 1,
          lessons: [
            {
              title: 'Quiz Lesson',
              type: 'quiz',
              order_index: 1,
              content_json: {
                type: 'quiz',
                body: {},
              },
            },
          ],
        },
      ],
    };

    const result = validateCoursePayload(payload);
    expect(result.ok).toBe(true);
  });

  it('rejects quiz lessons without questions when strict lesson-content enforcement is requested', () => {
    const payload = {
      course: {
        title: 'Strict Published Quiz Course',
        description: 'Strict mode enforces complete quiz content',
        status: 'published',
      },
      modules: [
        {
          title: 'Module 1',
          order_index: 1,
          lessons: [
            {
              title: 'Quiz Lesson',
              type: 'quiz',
              order_index: 1,
              content_json: {
                type: 'quiz',
                body: {},
              },
            },
          ],
        },
      ],
    };

    const result = validateCoursePayload(payload, { enforceLessonContent: true });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected strict payload validation to fail');
    }
    expect((result.issues ?? []).some((issue) => issue.code === 'lesson.quiz.invalid')).toBe(true);
  });

  it('accepts quiz questions serialized at the top level of content_json', () => {
    const payload = {
      course: {
        title: 'Quiz Course',
        description: 'Regression coverage for quiz payload validation',
        status: 'draft',
      },
      modules: [
        {
          title: 'Module 1',
          order_index: 1,
          lessons: [
            {
              title: 'Quiz Lesson',
              type: 'quiz',
              order_index: 1,
              content_json: {
                type: 'quiz',
                body: {},
                questions: [
                  {
                    id: 'q1',
                    prompt: 'What is 2 + 2?',
                    options: [
                      { id: 'a', text: '3', correct: false, isCorrect: false },
                      { id: 'b', text: '4', correct: true, isCorrect: true },
                    ],
                    correctAnswer: 'b',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = validateCoursePayload(payload);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected course payload validation to succeed');
    }
    expect(result.data?.modules?.[0]?.lessons?.[0]?.content_json?.body?.questions).toHaveLength(1);
  });

  it('accepts scenario lessons using content.scenario.nodes shape when strictly enforced', () => {
    const payload = {
      course: {
        title: 'Scenario Course',
        description: 'Regression coverage for scenario payload validation',
        status: 'published',
      },
      modules: [
        {
          title: 'Module 1',
          order_index: 1,
          lessons: [
            {
              title: 'Scenario Lesson',
              type: 'scenario',
              order_index: 1,
              content_json: {
                scenario: {
                  startNodeId: 'start',
                  nodes: [
                    {
                      id: 'start',
                      prompt: 'A teammate raises a concern. What do you do?',
                      options: [
                        { id: 'opt:1', label: 'Listen and ask follow-up questions' },
                        { id: 'opt:2', label: 'Dismiss the concern' },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    };

    const result = validateCoursePayload(payload, { enforceLessonContent: true });
    expect(result.ok).toBe(true);
  });

  it('rejects scenario lessons with no nodes when strictly enforced', () => {
    const payload = {
      course: {
        title: 'Empty Scenario Course',
        description: 'Regression coverage for scenario payload validation',
        status: 'published',
      },
      modules: [
        {
          title: 'Module 1',
          order_index: 1,
          lessons: [
            {
              title: 'Scenario Lesson',
              type: 'scenario',
              order_index: 1,
              content_json: {},
            },
          ],
        },
      ],
    };

    const result = validateCoursePayload(payload, { enforceLessonContent: true });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected strict scenario payload validation to fail');
    }
    expect((result.issues ?? []).some((issue) => issue.code === 'lesson.interactive.invalid')).toBe(true);
  });
});
