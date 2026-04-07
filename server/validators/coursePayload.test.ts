import { describe, expect, it } from 'vitest';
import { validateCoursePayload } from './coursePayload.js';

describe('validateCoursePayload quiz compatibility', () => {
  it('accepts quiz questions from content.body.quizQuestions even when content_json is empty', () => {
    const payload = {
      course: {
        title: 'Quiz Compatibility Course',
        description: 'Validation regression coverage',
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
              content_json: {},
              content: {
                body: {
                  quizQuestions: [
                    {
                      id: 'q-1',
                      prompt: 'Which one is correct?',
                      options: [
                        { id: 'a', text: 'Wrong', isCorrect: false },
                        { id: 'b', text: 'Correct', isCorrect: true },
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
    if (!result.ok || !result.data) {
      throw new Error('Expected validation to pass with normalized quiz question payload');
    }
    const questions = result.data.modules[0]?.lessons?.[0]?.content_json?.body?.questions;
    expect(Array.isArray(questions)).toBe(true);
    expect(questions?.length).toBe(1);
  });

  it('auto-normalizes duplicate lesson order_index values instead of returning lesson.order.duplicate', () => {
    const payload = {
      course: {
        title: 'Duplicate Lesson Order Course',
        description: 'Should normalize duplicate lesson order indexes.',
        status: 'draft',
      },
      modules: [
        {
          title: 'Module 1',
          order_index: 1,
          lessons: [
            { title: 'Lesson A', type: 'text', order_index: 2 },
            { title: 'Lesson B', type: 'text', order_index: 2 },
            { title: 'Lesson C', type: 'text', order_index: 1 },
          ],
        },
      ],
    };

    const result = validateCoursePayload(payload, { enforceLessonContent: false });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.data) throw new Error('Expected validation to succeed');

    expect(result.data.modules[0]?.lessons?.map((lesson) => lesson.title)).toEqual([
      'Lesson C',
      'Lesson A',
      'Lesson B',
    ]);
    expect(result.data.modules[0]?.lessons?.map((lesson) => lesson.order_index)).toEqual([1, 2, 3]);
  });

  it('fills missing lesson order indexes and normalizes random ordering deterministically', () => {
    const payload = {
      course: {
        title: 'Missing Lesson Order Course',
        description: 'Should auto-fill lesson order indexes.',
        status: 'draft',
      },
      modules: [
        {
          title: 'Module 1',
          order_index: 1,
          lessons: [
            { title: 'First in payload', type: 'text' },
            { title: 'Has explicit high order', type: 'text', order_index: 99 },
            { title: 'Second missing order', type: 'text' },
          ],
        },
      ],
    };

    const result = validateCoursePayload(payload, { enforceLessonContent: false });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.data) throw new Error('Expected validation to succeed');

    expect(result.data.modules[0]?.lessons?.map((lesson) => lesson.title)).toEqual([
      'First in payload',
      'Second missing order',
      'Has explicit high order',
    ]);
    expect(result.data.modules[0]?.lessons?.map((lesson) => lesson.order_index)).toEqual([1, 2, 3]);
  });
});
