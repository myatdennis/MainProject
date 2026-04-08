import { describe, it, expect } from 'vitest';

import type { NormalizedCourse } from '../courseNormalization';
import type { StoredCourseProgress } from '../courseProgress';
import {
  getInitialLesson,
  getFirstLessonId,
  getPreferredLessonId,
  getNextLesson,
  getPreviousLesson,
} from '../courseNavigation';

const buildCourse = (): NormalizedCourse => {
  const course = {
    id: 'course-1',
    slug: 'course-1',
    title: 'Course One',
    description: 'desc',
    thumbnail: '',
    difficulty: 'Beginner',
    duration: '1h',
    status: 'published',
    modules: [
      {
        id: 'module-2',
        title: 'Module B',
        description: '',
        duration: '20 min',
        order: 2,
        order_index: 2,
        lessons: [
          {
            id: 'lesson-3',
            title: 'Lesson 3',
            type: 'video',
            order: 1,
            order_index: 1,
            content: {},
          },
        ],
      },
      {
        id: 'module-1',
        title: 'Module A',
        description: '',
        duration: '20 min',
        order: 99,
        order_index: 1,
        lessons: [
          {
            id: 'lesson-2',
            title: 'Lesson 2',
            type: 'video',
            order: 10,
            order_index: 2,
            content: {},
          },
          {
            id: 'lesson-1',
            title: 'Lesson 1',
            type: 'video',
            order: 99,
            order_index: 1,
            content: {},
          },
        ],
      },
    ],
    chapters: [],
    lessons: 3,
  };

  return course as unknown as NormalizedCourse;
};

describe('courseNavigation canonical learner flow', () => {
  it('starts first-time learners at Module 1 Lesson 1 by order_index', () => {
    const course = buildCourse();

    const initial = getInitialLesson(course, null);

    expect(initial?.id).toBe('lesson-1');
    expect(getFirstLessonId(course)).toBe('lesson-1');
  });

  it('resumes returning learners with valid progress', () => {
    const course = buildCourse();
    const progress: StoredCourseProgress = {
      completedLessonIds: ['lesson-1'],
      lessonProgress: { 'lesson-1': 100, 'lesson-2': 45 },
      lessonPositions: { 'lesson-2': 120 },
      lastLessonId: 'lesson-2',
    };

    expect(getInitialLesson(course, progress)?.id).toBe('lesson-2');
    expect(getPreferredLessonId(course, progress)).toBe('lesson-2');
  });

  it('falls back safely when stored progress is stale/invalid', () => {
    const course = buildCourse();
    const progress: StoredCourseProgress = {
      completedLessonIds: ['ghost-lesson'],
      lessonProgress: { 'ghost-lesson': 100 },
      lessonPositions: { 'ghost-lesson': 50 },
      lastLessonId: 'ghost-lesson',
    };

    expect(getInitialLesson(course, progress)?.id).toBe('lesson-1');
  });

  it('navigates next/previous across module boundaries deterministically', () => {
    const course = buildCourse();

    expect(getNextLesson('lesson-2', course)?.id).toBe('lesson-3');
    expect(getPreviousLesson('lesson-3', course)?.id).toBe('lesson-2');
  });

  it('returns null at boundaries instead of looping/crashing', () => {
    const course = buildCourse();

    expect(getPreviousLesson('lesson-1', course)).toBeNull();
    expect(getNextLesson('lesson-3', course)).toBeNull();
  });

  it('handles malformed/empty course data gracefully', () => {
    const emptyCourse = {
      ...buildCourse(),
      modules: [{ id: 'm-1', title: 'Empty', description: '', duration: '', order: 1, lessons: [] }],
      lessons: 0,
    } as unknown as NormalizedCourse;

    expect(getInitialLesson(emptyCourse, null)).toBeNull();
    expect(getNextLesson('lesson-1', emptyCourse)).toBeNull();
    expect(getPreviousLesson('lesson-1', emptyCourse)).toBeNull();
  });
});
