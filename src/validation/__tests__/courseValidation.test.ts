import { describe, expect, it } from 'vitest';
import { validateCourse } from '../courseValidation';
import type { Course } from '../../types/courseTypes';

const buildBaseCourse = (): Course => ({
  id: 'course-1',
  title: 'Test Course Title',
  description: 'A sufficiently long description for validation to pass.',
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
    expect(result.isValid).toBe(false);
    expect(result.issues.find((issue) => issue.code === 'module.publishable.media_missing')).toBeDefined();
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
});
