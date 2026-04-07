import { describe, expect, it } from 'vitest';
import { shouldIncludeCourseForLearner } from '../clientCoursesUtils';

describe('shouldIncludeCourseForLearner', () => {
  it('returns true only when the course is explicitly assigned', () => {
    const assignmentMap = new Map([
      ['course-assigned', { id: 'a1', courseId: 'course-assigned', userId: 'u1', status: 'assigned' } as any],
    ]);

    expect(shouldIncludeCourseForLearner('course-assigned', assignmentMap)).toBe(true);
    expect(shouldIncludeCourseForLearner('course-published-but-not-assigned', assignmentMap)).toBe(false);
  });
});
