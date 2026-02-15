import { describe, expect, it } from 'vitest';
import { buildIssueTargets, getIssueTargetsOrEmpty } from '../../utils/validationIssues';
import type { CourseValidationIssue } from '../../validation/courseValidation';

const sampleIssue = (overrides: Partial<CourseValidationIssue>): CourseValidationIssue => ({
  code: 'test',
  message: 'Test issue',
  severity: 'error',
  ...overrides,
});

describe('validationIssues helpers', () => {
  it('returns empty maps when no issues provided', () => {
    const targets = buildIssueTargets();
    expect(targets.moduleMap.size).toBe(0);
    expect(targets.lessonMap.size).toBe(0);
    const fallback = getIssueTargetsOrEmpty(undefined);
    expect(fallback.moduleMap.size).toBe(0);
  });

  it('indexes module and lesson issue counts', () => {
    const issues: CourseValidationIssue[] = [
      sampleIssue({ moduleId: 'mod-1' }),
      sampleIssue({ moduleId: 'mod-1', lessonId: 'les-1' }),
      sampleIssue({ moduleId: 'mod-2', lessonId: 'les-2' }),
    ];
    const targets = buildIssueTargets(issues);
    expect(targets.moduleMap.get('mod-1')?.length).toBe(2);
    expect(targets.lessonMap.get('les-1')?.length).toBe(1);
    expect(getIssueTargetsOrEmpty(targets).moduleMap.get('mod-2')?.length).toBe(1);
  });
});
