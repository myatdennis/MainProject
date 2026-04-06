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
});
