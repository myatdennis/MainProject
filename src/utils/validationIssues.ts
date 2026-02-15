import type { CourseValidationIssue } from '../validation/courseValidation';

export type IssueTargets = {
  moduleMap: Map<string, CourseValidationIssue[]>;
  lessonMap: Map<string, CourseValidationIssue[]>;
};

const EMPTY_TARGETS: IssueTargets = {
  moduleMap: new Map(),
  lessonMap: new Map(),
};

export const buildIssueTargets = (issues?: CourseValidationIssue[] | null): IssueTargets => {
  if (!issues || issues.length === 0) {
    return {
      moduleMap: new Map(),
      lessonMap: new Map(),
    };
  }

  const moduleMap = new Map<string, CourseValidationIssue[]>();
  const lessonMap = new Map<string, CourseValidationIssue[]>();

  issues.forEach((issue) => {
    if (issue.moduleId) {
      moduleMap.set(issue.moduleId, [...(moduleMap.get(issue.moduleId) ?? []), issue]);
    }
    if (issue.lessonId) {
      lessonMap.set(issue.lessonId, [...(lessonMap.get(issue.lessonId) ?? []), issue]);
    }
  });

  return { moduleMap, lessonMap };
};

export const getIssueTargetsOrEmpty = (targets?: IssueTargets | null): IssueTargets => {
  if (!targets) {
    return EMPTY_TARGETS;
  }
  return targets;
};
