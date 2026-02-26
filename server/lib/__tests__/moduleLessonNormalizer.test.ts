import { describe, it, expect } from 'vitest';
import { normalizeModuleLessonPayloads } from '../moduleLessonNormalizer.js';

const fakePickOrgId = (...candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

describe('normalizeModuleLessonPayloads', () => {
  it('fills missing course/org/module fields using provided fallbacks', () => {
    const { modules, diagnostics } = normalizeModuleLessonPayloads(
      [
        {
          id: 'mod-alpha',
          title: 'Module Alpha',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Lesson One',
              type: 'video',
            },
          ],
        },
      ],
      { courseId: 'course-123', organizationId: 'org-456', pickOrgId: fakePickOrgId },
    );

    expect(modules[0]?.course_id).toBe('course-123');
    expect(modules[0]?.organization_id).toBe('org-456');
    expect(modules[0]?.lessons?.[0]?.module_id).toBe('mod-alpha');
    expect(modules[0]?.lessons?.[0]?.organization_id).toBe('org-456');
    expect(modules[0]?.lessons?.[0]?.course_id).toBe('course-123');
    expect(diagnostics.modulesMissingCourseId).toBe(0);
    expect(diagnostics.modulesMissingOrgId).toBe(0);
    expect(diagnostics.lessonsMissingModuleId).toBe(0);
    expect(diagnostics.lessonsMissingOrgId).toBe(0);
    expect(diagnostics.lessonsMissingCourseId).toBe(0);
  });

  it('tracks diagnostics when normalization cannot infer identifiers', () => {
    const { diagnostics } = normalizeModuleLessonPayloads(
      [
        {
          id: 'mod-beta',
          title: 'Module Beta',
          lessons: [
            {
              id: 'lesson-2',
              title: 'Lesson Two',
              type: 'text',
            },
          ],
        },
      ],
      { pickOrgId: fakePickOrgId },
    );

    expect(diagnostics.modulesMissingCourseId).toBe(1);
    expect(diagnostics.modulesMissingOrgId).toBe(1);
    expect(diagnostics.lessonsMissingModuleId).toBe(0);
    expect(diagnostics.lessonsMissingOrgId).toBe(1);
    expect(diagnostics.lessonsMissingCourseId).toBe(1);
  });
});