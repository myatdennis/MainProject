import { describe, expect, it } from 'vitest';
import { validateCoursePayload } from '../../../server/validators/coursePayload.js';

describe('validateCoursePayload', () => {
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
    expect(result.data.modules[0].lessons[0].content_json.body.questions).toHaveLength(1);
  });
});
