import { describe, it, expect } from 'vitest';
import { validateCourse } from './courseValidation.js';

const baseCourse = (overrides = {}) => ({
  id: 'course-1',
  title: 'A Well Titled Course',
  description: 'A description that is definitely long enough to pass the publish-time minimum length check.',
  status: 'published',
  modules: [],
  ...overrides,
});

describe('validateCourse - documented import-template content shapes', () => {
  it('accepts a text lesson using content_json.body.{introduction, key_points} shape', () => {
    const course = baseCourse({
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Text Lesson',
              type: 'text',
              content: {
                introduction: 'Some real learner-facing content.',
                key_points: ['Point one', 'Point two'],
              },
            },
          ],
        },
      ],
    });

    const result = validateCourse(course, { intent: 'publish' });
    const textIssues = result.issues.filter((issue) => issue.code === 'lesson.text.content_missing');
    expect(textIssues).toHaveLength(0);
  });

  it('rejects a text lesson with no introduction/key_points/textContent', () => {
    const course = baseCourse({
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [{ id: 'lesson-1', title: 'Text Lesson', type: 'text', content: {} }],
        },
      ],
    });

    const result = validateCourse(course, { intent: 'publish' });
    expect(result.issues.some((issue) => issue.code === 'lesson.text.content_missing')).toBe(true);
  });

  it('accepts a quiz lesson using content_json.quiz.questions with choices/correct shape', () => {
    const course = baseCourse({
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Quiz Lesson',
              type: 'quiz',
              content: {
                quiz: {
                  questions: [
                    {
                      prompt: 'Which option is correct?',
                      choices: [
                        { id: 'a', text: 'Wrong answer' },
                        { id: 'b', text: 'Right answer', correct: true },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    });

    const result = validateCourse(course, { intent: 'publish' });
    const quizIssues = result.issues.filter((issue) => issue.code.startsWith('lesson.quiz'));
    expect(quizIssues).toHaveLength(0);
  });

  it('rejects a quiz lesson with no questions in any recognized shape', () => {
    const course = baseCourse({
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [{ id: 'lesson-1', title: 'Quiz Lesson', type: 'quiz', content: {} }],
        },
      ],
    });

    const result = validateCourse(course, { intent: 'publish' });
    expect(result.issues.some((issue) => issue.code === 'lesson.quiz.questions_missing')).toBe(true);
  });
});
