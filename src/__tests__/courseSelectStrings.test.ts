import { describe, it, expect } from 'vitest';
import {
  COURSE_WITH_MODULES_LESSONS_SELECT,
  COURSE_MODULES_WITH_LESSON_FIELDS,
} from '../../server/constants/courseSelect.js';

describe('course select relationship strings', () => {
  const REQUIRED_RELATIONSHIPS = ['modules_course_id_fkey', 'lessons_module_id_fkey'];

  it('keeps course detail select scoped to explicit relationships', () => {
    REQUIRED_RELATIONSHIPS.forEach((relationship) => {
      expect(COURSE_WITH_MODULES_LESSONS_SELECT.includes(relationship)).toBe(true);
    });
  });

  it('keeps admin structure select scoped to explicit relationships', () => {
    REQUIRED_RELATIONSHIPS.forEach((relationship) => {
      expect(COURSE_MODULES_WITH_LESSON_FIELDS.includes(relationship)).toBe(true);
    });
  });
});
