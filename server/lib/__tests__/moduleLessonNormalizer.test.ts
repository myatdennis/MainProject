import { describe, it, expect } from 'vitest';
import { normalizeModuleLessonPayloads, normalizeLessonOrder } from '../moduleLessonNormalizer.js';

const fakePickOrgId = (...candidates: unknown[]) => {
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

  it('normalizes lesson order_index values to unique sequential values even when duplicates are supplied', () => {
    const modules = [
      {
        id: 'mod-gamma',
        lessons: [
          { id: 'l1', title: 'First', type: 'text', order_index: 2 },
          { id: 'l2', title: 'Second', type: 'text', order_index: 2 },
          { id: 'l3', title: 'Third', type: 'text', order_index: 1 },
        ],
      },
    ];

    const normalized = normalizeLessonOrder(modules as any);
    const lessonOrders = normalized[0].lessons.map((lesson: any) => lesson.order_index);

    expect(lessonOrders).toEqual([1, 2, 3]);
    expect(normalized[0].lessons.map((lesson: any) => lesson.id)).toEqual(['l3', 'l1', 'l2']);
  });

  it('fills missing lesson order_index values and preserves deterministic sort order', () => {
    const modules = [
      {
        id: 'mod-delta',
        lessons: [
          { id: 'la', title: 'A', type: 'text' },
          { id: 'lb', title: 'B', type: 'text', order_index: 10 },
          { id: 'lc', title: 'C', type: 'text' },
        ],
      },
    ];

    const normalized = normalizeLessonOrder(modules as any);
    expect(normalized[0].lessons.map((lesson: any) => lesson.id)).toEqual(['la', 'lc', 'lb']);
    expect(normalized[0].lessons.map((lesson: any) => lesson.order_index)).toEqual([1, 2, 3]);
  });

  it('reports lessonsOrderNormalized diagnostics when order values are rewritten', () => {
    const { diagnostics, modules } = normalizeModuleLessonPayloads(
      [
        {
          id: 'mod-epsilon',
          lessons: [
            { id: 'l-one', title: 'One', type: 'text', order_index: 9 },
            { id: 'l-two', title: 'Two', type: 'text', order_index: 3 },
          ],
        },
      ],
      { courseId: 'course-1', organizationId: 'org-1', pickOrgId: fakePickOrgId },
    );

    expect(modules[0].lessons.map((lesson: any) => lesson.order_index)).toEqual([1, 2]);
    expect(diagnostics.lessonsOrderNormalized).toBeGreaterThan(0);
  });
});
