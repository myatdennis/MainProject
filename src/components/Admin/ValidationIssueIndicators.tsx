import type { FC } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { IssueTargets } from '../../utils/validationIssues';

type ModuleBadgeProps = {
  issueTargets?: IssueTargets | null;
  moduleId: string;
};

type LessonTagProps = {
  issueTargets?: IssueTargets | null;
  lessonId: string;
};

const countModuleIssues = (issueTargets: IssueTargets | undefined | null, moduleId: string): number =>
  issueTargets?.moduleMap?.get(moduleId)?.length ?? 0;

const countLessonIssues = (issueTargets: IssueTargets | undefined | null, lessonId: string): number =>
  issueTargets?.lessonMap?.get(lessonId)?.length ?? 0;

export const ModuleIssueBadge: FC<ModuleBadgeProps> = ({ issueTargets, moduleId }) => {
  const count = countModuleIssues(issueTargets, moduleId);
  if (!count) return null;
  return (
    <span
      className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
      data-testid={`module-issue-badge-${moduleId}`}
    >
      <AlertTriangle className="mr-1 h-3 w-3" />
      Needs attention ({count})
    </span>
  );
};

export const LessonIssueTag: FC<LessonTagProps> = ({ issueTargets, lessonId }) => {
  const count = countLessonIssues(issueTargets, lessonId);
  if (!count) return null;
  return (
    <span
      className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
      data-testid={`lesson-issue-tag-${lessonId}`}
    >
      <AlertTriangle className="mr-1 h-3 w-3" /> Fix required
    </span>
  );
};
