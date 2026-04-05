import { describe, expect, it } from 'vitest';
import { validateCourse } from '../courseValidation';
import type { Course } from '../../types/courseTypes';

const buildBaseCourse = (): Course => ({
  id: 'course-1',
  title: 'Test Course Title',
  description: 'A sufficiently long description for validation to pass.',
  thumbnail: '/api/placeholder/400/300',
  difficulty: 'Beginner',
  duration: '30 min',
  status: 'draft',
  modules: [],
});

describe('courseValidation', () => {
  it('accepts text lessons using legacy content field', () => {
    const course: Course = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Lesson 1',
              type: 'text',
              content: { content: 'Body text' },
            } as any,
          ],
        } as any,
      ],
    };

    const result = validateCourse(course, { intent: 'publish' });
    expect(result.isValid).toBe(true);
    expect(result.issues.find((issue) => issue.code === 'module.publishable.media_missing')).toBeUndefined();
    expect(result.issues.find((issue) => issue.code === 'lesson.text.content_missing')).toBeUndefined();
  });

  it('allows external video lessons without storage metadata', () => {
    const course: Course = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Video lesson',
              type: 'video',
              content: {
                videoSourceType: 'external',
                videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              },
            } as any,
          ],
        } as any,
      ],
    };

    const result = validateCourse(course, { intent: 'publish' });
    expect(result.issues.find((issue) => issue.code === 'lesson.video.metadata_missing')).toBeUndefined();
  });

  it('requires module media before publishing', () => {
    const course: Course = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Quiz lesson',
              type: 'quiz',
              content: {
                questions: [
                  {
                    text: 'Question 1',
                    options: ['Yes', 'No'],
                    correctAnswerIndex: 0,
                  },
                ],
              },
            } as any,
          ],
        } as any,
      ],
    };

    const result = validateCourse(course, { intent: 'publish' });
    expect(result.isValid).toBe(true);
  });

  it('rejects malformed quiz questions during publish validation', () => {
    const course: Course = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-quiz-invalid',
              title: 'Quiz lesson',
              type: 'quiz',
              content: {
                questions: [
                  {
                    prompt: 'Question without a valid answer key',
                    options: [],
                  },
                ],
              },
            } as any,
          ],
        } as any,
      ],
    };

    const result = validateCourse(course, { intent: 'publish' });
    expect(result.isValid).toBe(false);
    expect(result.issues.find((issue) => issue.code === 'lesson.quiz.invalid_question')).toBeDefined();
  });

  it('accepts resource and download lessons with file sources', () => {
    const resourceCourse: Course = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-resource',
              title: 'Resource lesson',
              type: 'resource',
              content: {
                fileUrl: 'https://cdn.example.com/resource.pdf',
              },
            } as any,
            {
              id: 'lesson-download',
              title: 'Download lesson',
              type: 'download',
              content: {
                documentAsset: {
                  publicUrl: 'https://cdn.example.com/worksheet.pdf',
                },
              },
            } as any,
          ],
        } as any,
      ],
    };

    const result = validateCourse(resourceCourse, { intent: 'publish' });
    expect(result.issues.find((issue) => issue.code === 'lesson.document.source_missing')).toBeUndefined();
  });

  it('requires reflection lessons to include learner-facing content', () => {
    const invalidCourse: Course = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-reflection',
              title: 'Reflection lesson',
              type: 'reflection',
              content: {},
            } as any,
          ],
        } as any,
      ],
    };

    const validCourse: Course = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-reflection',
              title: 'Reflection lesson',
              type: 'reflection',
              content: {
                reflectionPrompt: 'What did you learn?',
              },
            } as any,
          ],
        } as any,
      ],
    };

    const invalidResult = validateCourse(invalidCourse, { intent: 'publish' });
    expect(invalidResult.issues.find((issue) => issue.code === 'lesson.reflection.content_missing')).toBeDefined();

    const validResult = validateCourse(validCourse, { intent: 'publish' });
    expect(validResult.issues.find((issue) => issue.code === 'lesson.reflection.content_missing')).toBeUndefined();
  });
});
