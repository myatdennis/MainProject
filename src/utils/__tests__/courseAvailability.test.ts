import { describe, expect, it } from 'vitest';
import type { NormalizedCourse } from '../courseNormalization';
import type { StoredCourseProgress } from '../courseProgress';
import { evaluateCourseAvailability, hasStoredProgressHistory } from '../courseAvailability';

const buildCourse = (overrides: Partial<NormalizedCourse> = {}): NormalizedCourse => ({
  id: 'course-1',
  slug: 'course-1',
  title: 'Test Course',
  description: 'Test',
  thumbnail: '',
  difficulty: 'Beginner',
  duration: '10 min',
  status: 'published',
  modules: [],
  chapters: [],
  lessons: 0,
  ...overrides,
});

describe('courseAvailability', () => {
  it('marks published courses with active assignments as available', () => {
    const course = buildCourse();
    const result = evaluateCourseAvailability({ course, assignmentStatus: 'in-progress' });
    expect(result.isUnavailable).toBe(false);
    expect(result.isReadOnly).toBe(false);
  });

  it('treats completed assignments as read-only access', () => {
    const course = buildCourse();
    const result = evaluateCourseAvailability({ course, assignmentStatus: 'completed' });
    expect(result.isUnavailable).toBe(false);
    expect(result.isReadOnly).toBe(true);
  });

  it('blocks access when no assignment or history exists', () => {
    const course = buildCourse();
    const result = evaluateCourseAvailability({ course, assignmentStatus: null });
    expect(result.isUnavailable).toBe(true);
    expect(result.reason).toBe('no_history');
  });

  it('grants read-only access when local progress exists', () => {
    const course = buildCourse();
    const stored: StoredCourseProgress = {
      completedLessonIds: ['lesson-1'],
      lessonProgress: { 'lesson-1': 100 },
      lessonPositions: {},
    };
    const result = evaluateCourseAvailability({ course, storedProgress: stored });
    expect(result.isUnavailable).toBe(false);
    expect(result.isReadOnly).toBe(true);
  });

  it('keeps unpublished courses available as read-only when history exists', () => {
    const course = buildCourse({ status: 'archived' });
    const stored: StoredCourseProgress = {
      completedLessonIds: ['lesson-1'],
      lessonProgress: { 'lesson-1': 100 },
      lessonPositions: {},
    };
    const result = evaluateCourseAvailability({ course, storedProgress: stored });
    expect(result.isUnavailable).toBe(false);
    expect(result.reason).toBe('unpublished');
    expect(result.isReadOnly).toBe(true);
  });

  it('marks missing courses as unavailable', () => {
    const result = evaluateCourseAvailability({ course: null });
    expect(result.isUnavailable).toBe(true);
    expect(result.reason).toBe('missing');
  });

  it('detects stored progress history correctly', () => {
    const noProgress: StoredCourseProgress = { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} };
    const yesProgress: StoredCourseProgress = { completedLessonIds: [], lessonProgress: { a: 25 }, lessonPositions: {} };
    expect(hasStoredProgressHistory(noProgress)).toBe(false);
    expect(hasStoredProgressHistory(yesProgress)).toBe(true);
  });
});
