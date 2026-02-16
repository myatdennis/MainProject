import type { Course } from '../types/courseTypes';
import { validateCourse, type CourseValidationIntent, type CourseValidationIssue } from './courseValidation';
import { buildIssueTargets, type IssueTargets } from '../utils/validationIssues';

export interface CourseValidationSummary {
  intent: CourseValidationIntent;
  isValid: boolean;
  issues: CourseValidationIssue[];
  issueTargets: IssueTargets;
}

export const getCourseValidationSummary = (
  course: Course,
  intent: CourseValidationIntent,
): CourseValidationSummary => {
  const validationResult = validateCourse(course, { intent }) ?? { isValid: true, issues: [] };
  const issues = Array.isArray(validationResult.issues) ? validationResult.issues : [];
  const hasBlockingErrors = issues.some((issue) => issue.severity === 'error');

  return {
    intent,
    isValid: Boolean(validationResult.isValid) && !hasBlockingErrors,
    issues,
    issueTargets: buildIssueTargets(issues),
  };
};
