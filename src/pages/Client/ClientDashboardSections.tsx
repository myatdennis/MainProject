import {
  ArrowUpRight,
  Award,
  BookOpen,
  CalendarClock,
  ClipboardList,
  FileText,
  Inbox,
  Sparkles,
  Users,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import ProgressBar from '../../components/ui/ProgressBar';
import type { DocumentMeta } from '../../dal/documents';
import useDocumentDownload from '../../hooks/useDocumentDownload';
import type { LearnerSurveyAssignment } from '../../dal/surveys';
import type { CourseAssignment } from '../../types/assignment';
import type { Course } from '../../types/courseTypes';

export type BootStepName = 'session' | 'membership' | 'courses' | 'analytics';
export type BootStepStatus = 'idle' | 'running' | 'success' | 'error' | 'timeout';

export type BootStepState = {
  status: BootStepStatus;
  error: string | null;
};

export type OnboardingWelcomePayload = {
  orgId?: string | null;
  orgName?: string | null;
  email?: string;
  recordedAt?: string;
  assignments?: {
    courses?: number;
    surveys?: number;
  };
};

export type DashboardCourseEntry = {
  course: Course;
  assignment: CourseAssignment | null;
  progressPercent: number;
  preferredLessonId: string | null;
};

const statusColorMap: Record<BootStepStatus, string> = {
  idle: 'text-slate-400',
  running: 'text-blue-600',
  success: 'text-emerald-600',
  error: 'text-rose-600',
  timeout: 'text-amber-600',
};

const ResourceQuickAction = ({ document }: { document: DocumentMeta }) => {
  const { download, isLoading, error } = useDocumentDownload(document);
  return (
    <div className="flex flex-col items-end gap-1 text-xs">
      <Button variant="ghost" size="sm" onClick={() => download()} disabled={isLoading || !document.id}>
        {isLoading ? 'Opening…' : 'Open'}
      </Button>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
};

export const ClientDashboardHero = ({
  contextualGreeting,
  learnerFirstName,
  progressSnapshotLabel,
  inProgressCount,
  onOpenLms,
}: {
  contextualGreeting: string;
  learnerFirstName: string;
  progressSnapshotLabel: string;
  inProgressCount: number;
  onOpenLms: () => void;
}) => (
  <Card tone="gradient" withBorder={false} className="overflow-hidden">
    <div className="relative z-10 flex flex-col gap-4 text-charcoal md:flex-row md:items-center md:justify-between">
      <div>
        <Badge tone="info" className="flex items-center gap-2 bg-white/80 text-skyblue">
          <Sparkles className="h-3.5 w-3.5" />
          Client Portal
        </Badge>
        <h1 className="mt-4 font-heading text-3xl font-bold md:text-4xl">
          {contextualGreeting}, {learnerFirstName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate/80">{progressSnapshotLabel}</p>
        <p className="mt-1 text-sm text-slate/70">
          {inProgressCount} {inProgressCount === 1 ? 'course' : 'courses'} in progress
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="ghost"
          size="sm"
          trailingIcon={<ArrowUpRight className="h-4 w-4" />}
          onClick={onOpenLms}
        >
          Go to full learning hub
        </Button>
      </div>
    </div>
  </Card>
);

export const ClientDashboardStatsGrid = ({
  assignedCourseCount,
  completedCount,
  inProgressCount,
  onBrowseCourses,
  onOpenLms,
}: {
  assignedCourseCount: number;
  completedCount: number;
  inProgressCount: number;
  onBrowseCourses: () => void;
  onOpenLms: () => void;
}) => (
  <div className="mt-8 grid gap-4 md:grid-cols-4">
    <Card tone="muted" className="py-6 text-center transition-all duration-200 hover:shadow-card">
      <div className="font-heading text-3xl font-bold text-charcoal">{assignedCourseCount}</div>
      <p className="text-xs uppercase tracking-wide text-slate/70">Assigned courses</p>
    </Card>
    <Card tone="muted" className="py-6 text-center transition-all duration-200 hover:shadow-card">
      <div className="font-heading text-3xl font-bold text-charcoal">{completedCount}</div>
      <p className="text-xs uppercase tracking-wide text-slate/70">Completed</p>
    </Card>
    <Card tone="muted" className="py-6 text-center transition-all duration-200 hover:shadow-card">
      <div className="font-heading text-3xl font-bold text-charcoal">{inProgressCount}</div>
      <p className="text-xs uppercase tracking-wide text-slate/70">In progress</p>
    </Card>
    <Card tone="muted" className="space-y-2 py-6">
      <p className="text-xs uppercase tracking-wide text-slate/70">Quick actions</p>
      <Button size="sm" className="w-full" onClick={onBrowseCourses}>
        Browse courses
      </Button>
      <Button variant="ghost" size="sm" className="w-full" onClick={onOpenLms}>
        Continue learning
      </Button>
    </Card>
  </div>
);

export const ContinueLearningCard = ({
  courseTitle,
  lessonTitle,
  progressPercent,
  onResume,
}: {
  courseTitle: string;
  lessonTitle: string;
  progressPercent: number;
  onResume: () => void;
}) => (
  <section aria-label="Continue where you left off" className="mt-6">
    <Card className="border border-skyblue/20 bg-gradient-to-r from-white via-skyblue/5 to-indigo-50/60 shadow-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-skyblue">Continue where you left off</p>
          <h2 className="mt-2 font-heading text-2xl font-semibold text-charcoal">{courseTitle}</h2>
          <p className="mt-1 text-sm text-slate/80">Lesson: {lessonTitle}</p>
          <div className="mt-3 max-w-md">
            <ProgressBar value={progressPercent} srLabel="Resume course progress" />
          </div>
        </div>
        <Button size="sm" className="shadow-md transition-transform active:scale-[0.98]" onClick={onResume}>
          Resume now
        </Button>
      </div>
    </Card>
  </section>
);

export const OnboardingWelcomeCard = ({
  welcomeExperience,
  userEmail,
  onDismiss,
  onStartCourses,
  onViewSurveys,
  onViewResources,
}: {
  welcomeExperience: OnboardingWelcomePayload;
  userEmail?: string;
  onDismiss: () => void;
  onStartCourses: () => void;
  onViewSurveys: () => void;
  onViewResources: () => void;
}) => (
  <Card className="mt-6 space-y-3 border border-emerald-200 bg-emerald-50/70">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-emerald-700">Onboarding complete</p>
        <h3 className="font-heading text-xl font-semibold text-emerald-900">
          {welcomeExperience.orgName ? `Welcome to ${welcomeExperience.orgName}` : 'Welcome aboard'}
        </h3>
        <p className="text-sm text-emerald-800">
          Sign in with <span className="font-semibold">{welcomeExperience.email ?? userEmail}</span> to access your
          assignments and shared resources immediately.
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
    <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-900">
      {welcomeExperience.assignments?.courses ? (
        <li>
          {welcomeExperience.assignments.courses} course
          {welcomeExperience.assignments.courses > 1 ? 's' : ''} ready to begin.
        </li>
      ) : (
        <li>Courses will appear on your dashboard as soon as they’re assigned.</li>
      )}
      {welcomeExperience.assignments?.surveys ? (
        <li>
          {welcomeExperience.assignments.surveys} survey
          {welcomeExperience.assignments.surveys > 1 ? 's' : ''} awaiting your input.
        </li>
      ) : (
        <li>Survey invitations will appear here once scheduled.</li>
      )}
      <li>Shared resources and announcements are one click away.</li>
    </ul>
    <div className="flex flex-wrap gap-3">
      <Button size="sm" onClick={onStartCourses}>
        Start courses
      </Button>
      <Button size="sm" variant="secondary" onClick={onViewSurveys}>
        View surveys
      </Button>
      <Button size="sm" variant="ghost" onClick={onViewResources}>
        View resources
      </Button>
    </div>
  </Card>
);

export const AssignedCoursesSection = ({
  assignmentsLoading,
  hasAssignedCourses,
  showingFallbackCatalog,
  learnerCatalogEmpty,
  assignedCourseCount,
  displayedCourseDetails,
  onBrowseCourses,
  onVisitLms,
  onOpenCourse,
}: {
  assignmentsLoading: boolean;
  hasAssignedCourses: boolean;
  showingFallbackCatalog: boolean;
  learnerCatalogEmpty: boolean;
  assignedCourseCount: number;
  displayedCourseDetails: DashboardCourseEntry[];
  onBrowseCourses: () => void;
  onVisitLms: () => void;
  onOpenCourse: (entry: DashboardCourseEntry) => void;
}) => (
  <section aria-label="Assigned courses">
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-charcoal">Assigned courses</h2>
        <Badge tone="info" className="bg-skyblue/10 text-skyblue">
          {assignedCourseCount}
        </Badge>
      </div>
      {assignmentsLoading ? (
        <div className="space-y-3 py-2" aria-label="Loading assignments">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-2xl border border-mist bg-white/80 p-4">
              <div className="h-4 w-1/2 rounded bg-cloud" />
              <div className="mt-2 h-3 w-1/3 rounded bg-cloud" />
              <div className="mt-4 h-2 w-full rounded bg-cloud" />
            </div>
          ))}
        </div>
      ) : !hasAssignedCourses && !showingFallbackCatalog && learnerCatalogEmpty ? (
        <div className="rounded-2xl border border-dashed border-mist bg-cloud/60 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-skyblue">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-heading text-base font-semibold text-charcoal">No courses available yet</h3>
          <p className="mt-2 text-sm text-slate/70">
            Your organization hasn&apos;t published any courses yet. Reach out to your administrator to get programs
            scheduled for your account.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button variant="ghost" size="sm" onClick={onVisitLms}>
              Visit full LMS
            </Button>
          </div>
        </div>
      ) : !hasAssignedCourses && !showingFallbackCatalog ? (
        <div className="rounded-2xl border border-dashed border-mist bg-cloud/60 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-skyblue">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-heading text-base font-semibold text-charcoal">No assignments yet</h3>
          <p className="mt-2 text-sm text-slate/70">
            You’re all set — your learning plan will appear here as soon as your facilitator assigns it. You can still
            browse available content anytime.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button size="sm" onClick={onBrowseCourses}>
              Browse courses
            </Button>
            <Button variant="ghost" size="sm" onClick={onVisitLms}>
              Visit full LMS
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {showingFallbackCatalog && (
            <div className="rounded-lg border border-slate/20 bg-slate/30 px-3 py-2 text-xs text-slate/80">
              No direct assignments yet. Showing published catalog items so you can keep learning.
            </div>
          )}
          {displayedCourseDetails.map((entry) => (
            <Card
              key={entry.course.id}
              tone="muted"
              className="space-y-2 transition-all duration-200 hover:shadow-card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading text-sm font-semibold text-charcoal">{entry.course.title}</p>
                  <p className="text-xs text-slate/70">
                    Due {entry.assignment?.dueDate ? new Date(entry.assignment.dueDate).toLocaleDateString() : '—'}
                  </p>
                </div>
                <Button size="sm" onClick={() => onOpenCourse(entry)}>
                  {entry.progressPercent > 0 ? 'Continue' : 'Start'}
                </Button>
              </div>
              <ProgressBar value={entry.progressPercent} srLabel={`${entry.course.title} completion`} />
            </Card>
          ))}
        </div>
      )}
    </Card>
  </section>
);

export const SharedResourcesCard = ({
  resourcesLoading,
  resourcesError,
  featuredResources,
  extraResources,
  onNavigateToResources,
}: {
  resourcesLoading: boolean;
  resourcesError: string | null;
  featuredResources: DocumentMeta[];
  extraResources: number;
  onNavigateToResources: () => void;
}) => (
  <Card className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate/10 text-slate">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-heading text-base font-semibold text-charcoal">Shared resources</h3>
          <p className="text-xs text-slate/70">Latest files and documents from your admin team.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {resourcesError && (
          <Badge tone="attention" className="text-[11px]">
            {resourcesError}
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={onNavigateToResources}>
          View all
        </Button>
      </div>
    </div>
    {resourcesLoading ? (
      <div className="space-y-3 py-2" aria-label="Loading resources">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-xl border border-mist bg-white/80 p-3">
            <div className="h-4 w-2/3 rounded bg-cloud" />
            <div className="mt-2 h-3 w-1/3 rounded bg-cloud" />
          </div>
        ))}
      </div>
    ) : featuredResources.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-mist bg-cloud/60 p-4 text-sm text-slate/70">
        No shared documents yet. Your facilitator will add resources soon.
      </div>
    ) : (
      <ul className="space-y-3">
        {featuredResources.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate/20 bg-white/90 p-3"
          >
            <div>
              <p className="font-heading text-sm font-semibold text-charcoal">{doc.name}</p>
              <p className="text-xs text-slate/70">
                {doc.category} • {doc.visibility === 'org' ? 'Organization' : 'Global'}
              </p>
            </div>
            {doc.url ? <ResourceQuickAction document={doc} /> : <span className="text-xs text-slate/60">No file</span>}
          </li>
        ))}
      </ul>
    )}
    {extraResources > 0 && (
      <Button variant="ghost" size="sm" onClick={onNavigateToResources}>
        See {extraResources} more
      </Button>
    )}
  </Card>
);

const formatDueDateLabel = (iso?: string | null) => {
  if (!iso) return 'No due date';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return 'No due date';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(parsed),
  );
};

const describeDueDate = (iso?: string | null) => {
  if (!iso) return { label: 'No due date', overdue: false };
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return { label: 'No due date', overdue: false };
  return {
    label: formatDueDateLabel(iso),
    overdue: parsed < Date.now(),
  };
};

const isDueSoon = (iso?: string | null) => {
  if (!iso) return false;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return false;
  const diff = parsed - Date.now();
  return diff > 0 && diff <= 3 * 24 * 60 * 60 * 1000;
};

const getSurveyStatusLabel = (assignment: LearnerSurveyAssignment['assignment']) => {
  if (assignment.status === 'completed') return 'Completed';
  const dueInfo = describeDueDate(assignment.dueDate);
  if (dueInfo.overdue) return 'Overdue';
  if (assignment.status === 'in-progress' && isDueSoon(assignment.dueDate)) return 'Due soon';
  if (assignment.status === 'in-progress') return 'In progress';
  return isDueSoon(assignment.dueDate) ? 'Due soon' : 'Not started';
};

const getSurveyBadgeTone = (
  assignment: LearnerSurveyAssignment['assignment'],
  overdue: boolean,
): 'positive' | 'info' | 'attention' | 'danger' => {
  if (assignment.status === 'completed') return 'positive';
  if (overdue) return 'danger';
  if (isDueSoon(assignment.dueDate)) return 'attention';
  if (assignment.status === 'in-progress') return 'info';
  return 'attention';
};

const extractSurveyLink = (assignment: CourseAssignment | null) => {
  if (!assignment?.metadata || typeof assignment.metadata !== 'object') {
    return null;
  }
  const metadata = assignment.metadata as Record<string, unknown>;
  const candidate =
    (typeof metadata.survey_url === 'string' && metadata.survey_url) ||
    (typeof metadata.link === 'string' && metadata.link) ||
    (typeof metadata.url === 'string' && metadata.url);
  if (candidate && typeof candidate === 'string' && candidate.trim().startsWith('http')) {
    return candidate.trim();
  }
  return null;
};

export const SurveyStatsGrid = ({
  total,
  completed,
  inProgress,
  overdue,
  nextDueTitle,
  nextDueDate,
}: {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  nextDueTitle: string | null;
  nextDueDate?: string | null;
}) => (
  <div className="mt-6 grid gap-4 md:grid-cols-3">
    <Card tone="muted" className="py-6 text-center">
      <div className="font-heading text-3xl font-bold text-charcoal">{total}</div>
      <p className="text-xs uppercase tracking-wide text-slate/70">Assigned surveys</p>
    </Card>
    <Card tone="muted" className="py-6 text-center">
      <div className="font-heading text-3xl font-bold text-charcoal">{completed}</div>
      <p className="text-xs uppercase tracking-wide text-slate/70">Surveys completed</p>
      <p className="mt-1 text-xs text-slate/60">{inProgress} in progress</p>
    </Card>
    <Card tone="muted" className="py-6">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate/70">
        <CalendarClock className="h-4 w-4 text-slate/70" />
        Next survey due
      </p>
      {nextDueTitle ? (
        <div className="mt-2">
          <div className="font-heading text-base font-semibold text-charcoal">{nextDueTitle}</div>
          <p className="text-sm text-slate/70">{formatDueDateLabel(nextDueDate)}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate/70">No upcoming deadlines</p>
      )}
      {overdue > 0 && (
        <Badge tone="danger" className="mt-3 inline-flex">
          {overdue} overdue
        </Badge>
      )}
    </Card>
  </div>
);

export const AssignedSurveysSection = ({
  surveyAssignmentsLoading,
  surveyAssignmentsError,
  surveyAssignments,
  featuredSurveyAssignments,
  onViewAll,
  onReviewSurvey,
}: {
  surveyAssignmentsLoading: boolean;
  surveyAssignmentsError: string | null;
  surveyAssignments: LearnerSurveyAssignment[];
  featuredSurveyAssignments: LearnerSurveyAssignment[];
  onViewAll: () => void;
  onReviewSurvey: (assignmentId?: string, surveyId?: string | null) => void;
}) => (
  <Card className="mt-8 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-charcoal">
          <ClipboardList className="h-5 w-5 text-slate/60" />
          Assigned surveys
        </h2>
        <p className="text-sm text-slate/70">Track listening pulses and feedback requests from your organization.</p>
      </div>
      <div className="flex items-center gap-2">
        {surveyAssignmentsError && !surveyAssignmentsLoading && (
          <Badge tone="attention" className="text-[11px]">
            {surveyAssignmentsError}
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          View all
        </Button>
      </div>
    </div>
    {surveyAssignmentsLoading ? (
      <div className="space-y-3 py-2" aria-label="Loading surveys">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-2xl border border-mist bg-white/80 p-4">
            <div className="h-4 w-2/5 rounded bg-cloud" />
            <div className="mt-2 h-3 w-1/4 rounded bg-cloud" />
            <div className="mt-4 h-8 w-28 rounded bg-cloud" />
          </div>
        ))}
      </div>
    ) : surveyAssignments.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-mist bg-cloud/60 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate/70">
          <ClipboardList className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-heading text-base font-semibold text-charcoal">No surveys yet</h3>
        <p className="mt-2 text-sm text-slate/70">
          You’ll see culture and engagement surveys here as soon as they’re assigned.
        </p>
      </div>
    ) : (
      <div className="space-y-3">
        {featuredSurveyAssignments.map((entry) => {
          const { assignment, survey } = entry;
          const due = describeDueDate(assignment.dueDate);
          const tone = getSurveyBadgeTone(assignment, due.overdue);
          const statusLabel = getSurveyStatusLabel(assignment);
          const surveyLink = extractSurveyLink(assignment);
          return (
            <div key={assignment.id} className="rounded-2xl border border-slate/20 bg-white/90 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-base font-semibold text-charcoal">
                    {survey?.title ?? 'Untitled survey'}
                  </p>
                  <p className="text-xs text-slate/70">
                    {due.overdue && assignment.status !== 'completed' ? 'Overdue • ' : ''}
                    {due.label}
                  </p>
                </div>
                <Badge tone={tone}>{statusLabel}</Badge>
              </div>
              {survey?.description && <p className="mt-2 line-clamp-2 text-sm text-slate/70">{survey.description}</p>}
              {assignment.note && <p className="mt-2 text-sm italic text-slate/70">{assignment.note}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate/70">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {due.label}
                </span>
                {assignment.assignedBy && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Assigned by {assignment.assignedBy}
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button size="sm" onClick={() => onReviewSurvey(assignment.id, survey?.id)}>
                  Review details
                </Button>
                {surveyLink && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={surveyLink} target="_blank" rel="noreferrer">
                      Open survey
                    </a>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {surveyAssignments.length > featuredSurveyAssignments.length && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            See {surveyAssignments.length - featuredSurveyAssignments.length} more
          </Button>
        )}
      </div>
    )}
  </Card>
);

export const StayConnectedCard = ({ onOpenLms }: { onOpenLms: () => void }) => (
  <Card tone="muted" className="space-y-4">
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sunrise/10 text-sunrise">
        <Users className="h-5 w-5" />
      </span>
      <div>
        <h3 className="font-heading text-base font-semibold text-charcoal">Stay connected</h3>
        <p className="text-xs text-slate/70">Use the full LMS to access discussions, resources, and certificates.</p>
      </div>
    </div>
    <ul className="space-y-2 text-sm text-slate/80">
      <li className="flex items-center gap-2">
        <BookOpen className="h-4 w-4" /> Resume lessons exactly where you left off.
      </li>
      <li className="flex items-center gap-2">
        <FileText className="h-4 w-4" /> Access downloadable resources and transcripts.
      </li>
      <li className="flex items-center gap-2">
        <Award className="h-4 w-4" /> Earn certificates when you finish programs.
      </li>
    </ul>
    <Button
      variant="ghost"
      size="sm"
      trailingIcon={<ArrowUpRight className="h-4 w-4" />}
      onClick={onOpenLms}
    >
      Go to LMS
    </Button>
  </Card>
);

export const BootDebugOverlay = ({
  orderedBootSteps,
  steps,
  onRetry,
}: {
  orderedBootSteps: BootStepName[];
  steps: Record<BootStepName, BootStepState>;
  onRetry: () => void;
}) => {
  const entries = orderedBootSteps.map((name) => ({ name, ...steps[name] }));
  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md rounded-2xl border border-slate/30 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate/70">Boot Steps</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
      <div className="max-h-72 overflow-y-auto pr-2">
        <ol className="space-y-2 text-xs">
          {entries.map((step) => (
            <li key={step.name} className="rounded-lg border border-slate/20 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold capitalize">{step.name}</span>
                <span className={statusColorMap[step.status]}>{step.status}</span>
              </div>
              {step.error && <p className="mt-1 text-[11px] text-rose-700">{step.error}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
