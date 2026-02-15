import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModuleIssueBadge, LessonIssueTag } from '../ValidationIssueIndicators';
import { buildIssueTargets } from '../../../utils/validationIssues';
import type { CourseValidationIssue } from '../../validation/courseValidation';

const baseIssue = (overrides: Partial<CourseValidationIssue>): CourseValidationIssue => ({
  code: 'test',
  message: 'Test issue',
  severity: 'error',
  ...overrides,
});

describe('ValidationIssueIndicators', () => {
  it('renders nothing when issueTargets is undefined', () => {
    const { container } = render(<ModuleIssueBadge issueTargets={undefined} moduleId="mod-1" />);
    expect(container.textContent).toBe('');
  });

  it('renders module and lesson badges when counts exist', () => {
    const issues = [
      baseIssue({ moduleId: 'mod-1' }),
      baseIssue({ moduleId: 'mod-1', lessonId: 'lesson-1' }),
    ];
    const targets = buildIssueTargets(issues);
    render(
      <>
        <ModuleIssueBadge issueTargets={targets} moduleId="mod-1" />
        <LessonIssueTag issueTargets={targets} lessonId='lesson-1' />
      </>,
    );
    expect(screen.getByTestId('module-issue-badge-mod-1')).toHaveTextContent('Needs attention (2)');
    expect(screen.getByTestId('lesson-issue-tag-lesson-1')).toHaveTextContent('Fix required');
  });
});
