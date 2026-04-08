import { describe, it, expect } from 'vitest';
import { sanitizeModuleGraph } from '../courseStore';
import type { Module } from '../../types/courseTypes';
import isUuid from '../../utils/isUuid';

describe('sanitizeModuleGraph identifier normalization', () => {
  it('replaces non-UUID ids and preserves client_temp_id', () => {
    const modules: Module[] = [
      {
        id: 'mod-temp-123',
        title: 'Tmp Module',
        description: '',
        duration: '0 min',
        order: 1,
        lessons: [
          {
            id: 'les-temp-1',
            title: 'Tmp Lesson',
            description: '',
            type: 'text',
            order: 1,
            content: {},
          } as any,
        ],
        resources: [],
      },
    ];

    const normalized = sanitizeModuleGraph(modules);
    expect(normalized).toHaveLength(1);
    const module = normalized[0]!;
    expect(isUuid(module.id)).toBe(true);
    expect(module.client_temp_id).toBe('mod-temp-123');
    const lesson = module.lessons[0]!;
    expect(isUuid(lesson.id)).toBe(true);
    expect(lesson.client_temp_id).toBe('les-temp-1');
    expect(lesson.module_id).toBe(module.id);
  });

  it('maps non-UUID ids to stable deterministic UUIDs across refreshes', () => {
    const modules: Module[] = [
      {
        id: 'legacy-module-id',
        title: 'Legacy Module',
        description: '',
        duration: '0 min',
        order: 1,
        lessons: [
          {
            id: 'legacy-lesson-id',
            title: 'Legacy Lesson',
            description: '',
            type: 'text',
            order: 1,
            content: {},
          } as any,
        ],
        resources: [],
      },
    ];

    const normalizedFirst = sanitizeModuleGraph(modules);
    const normalizedSecond = sanitizeModuleGraph(modules);

    expect(normalizedFirst[0]?.id).toBe(normalizedSecond[0]?.id);
    expect(normalizedFirst[0]?.lessons[0]?.id).toBe(normalizedSecond[0]?.lessons[0]?.id);
    expect(isUuid(normalizedFirst[0]!.id)).toBe(true);
    expect(isUuid(normalizedFirst[0]!.lessons[0]!.id)).toBe(true);
  });
});
