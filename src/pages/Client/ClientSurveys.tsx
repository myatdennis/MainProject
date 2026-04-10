import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarClock, ClipboardList, RefreshCw } from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { LoadingSpinner } from '../../components/LoadingComponents';
import {
  fetchAssignedSurveysForLearner,
  type LearnerSurveyAssignment,
} from '../../dal/surveys';
import { DalError, extractDalErrorDetail } from '../../dal/http';
import type { CourseAssignmentStatus } from '../../types/assignment';
import { subscribeSurveyAssignmentsChanged } from '../../utils/surveyAssignmentEvents';
import { getLearnerPortalBasePath } from '../../utils/learnerPortalPath';

const deriveStatusTone = (status: CourseAssignmentStatus, overdue: boolean) => {
  const statusValue = String(status);
  if (statusValue === 'completed') return 'positive' as const;
  if (overdue && statusValue !== 'completed') return 'danger' as const;
  if (statusValue === 'in-progress') return 'info' as const;
  return 'attention' as const;
};

const statusLabel = (status: CourseAssignmentStatus) => {
  const statusValue = String(status);
  if (statusValue === 'completed') return 'Completed';
  if (statusValue === 'in-progress') return 'In progress';
  return 'Assigned';
};

const describeDueDate = (iso?: string | null) => {
  if (!iso) return { label: 'No due date', overdue: false };
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return { label: 'No due date', overdue: false };
  const overdue = parsed < Date.now();
  return {
    label: new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(parsed)),
    overdue,
  };
};

const extractSurveyLink = (assignment: LearnerSurveyAssignment['assignment']) => {
  if (!assignment.metadata || typeof assignment.metadata !== 'object') {
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

const getEntrySurveyId = (entry: LearnerSurveyAssignment) =>
  entry.survey?.id ?? entry.assignment.surveyId ?? (entry.assignment as { survey_id?: string | null })?.survey_id ?? null;

const getEntrySurveyTitle = (entry: LearnerSurveyAssignment) => {
  if (entry.survey?.title) return entry.survey.title;
  const metadata = entry.assignment.metadata && typeof entry.assignment.metadata === 'object'
    ? (entry.assignment.metadata as Record<string, unknown>)
    : null;
  const fallbackTitle = metadata?.surveyTitle ?? metadata?.survey_title ?? metadata?.title ?? null;
  return typeof fallbackTitle === 'string' && fallbackTitle.trim() ? fallbackTitle.trim() : 'Assigned survey';
};

const getEntrySurveyDescription = (entry: LearnerSurveyAssignment) => {
  if (entry.survey?.description) return entry.survey.description;
  const metadata = entry.assignment.metadata && typeof entry.assignment.metadata === 'object'
    ? (entry.assignment.metadata as Record<string, unknown>)
    : null;
  const fallbackDescription = metadata?.surveyDescription ?? metadata?.survey_description ?? metadata?.description ?? null;
  return typeof fallbackDescription === 'string' && fallbackDescription.trim() ? fallbackDescription.trim() : '';
};

const ClientSurveys = () => {
  const [assignments, setAssignments] = useState<LearnerSurveyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const portalPath = getLearnerPortalBasePath(location.pathname);
  const highlightAssignmentId = useMemo(() => new URLSearchParams(location.search).get('assignment'), [location.search]);

  const refresh = useCallback(async () => {
    console.info('[learner-surveys] surveyListLoadStarted', {
      route: location.pathname,
    });
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAssignedSurveysForLearner();
      console.info('[learner-surveys] surveyListLoadSucceeded', {
        fetchedCount: rows.length,
        assignedSurveyIds: rows.map((entry) => getEntrySurveyId(entry)).filter(Boolean),
      });
      setAssignments(rows);
    } catch (err) {
      console.error('[learner-surveys] surveyListLoadFailed', err);
      setAssignments([]);
      if (err instanceof DalError) {
        const body = (err.body && typeof err.body === 'object' ? (err.body as Record<string, any>) : null) ?? {};
        const backendError = typeof body.error === 'string' ? body.error : null;
        if (err.status === 400 && backendError === 'explicit_org_selection_required') {
          setError('Select an organization to load surveys, then retry.');
        } else if (err.status === 403 && backendError === 'org_membership_required') {
          setError('Your account is not associated with an organization that can access surveys.');
        } else if (err.status === 503 && backendError === 'upstream_unavailable') {
          setError('Surveys are temporarily unavailable. Please retry in a moment.');
        } else if (err.code === 'AbortError') {
          setError('The surveys request timed out. Please retry.');
        } else {
          const detail = extractDalErrorDetail(err);
          setError(detail.message || 'Unable to load surveys right now. Please retry soon.');
        }
      } else {
        setError('Unable to load surveys right now. Please retry soon.');
      }
    } finally {
      setLoading(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = subscribeSurveyAssignmentsChanged((event) => {
      console.info('[learner-surveys] assignments invalidated', event);
      void refresh();
    });
    return unsubscribe;
  }, [refresh]);

  useEffect(() => {
    if (!highlightAssignmentId) return;
    const el = document.getElementById(`survey-assignment-${highlightAssignmentId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring-2', 'ring-skyblue/70', 'ring-offset-2', 'ring-offset-white');
      const timeout = window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-skyblue/70', 'ring-offset-2', 'ring-offset-white');
      }, 2000);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [highlightAssignmentId, assignments.length]);

  const pendingAssignments = useMemo(
    () => assignments.filter((entry) => entry.assignment.status !== 'completed'),
    [assignments],
  );
  const completedAssignments = useMemo(
    () => assignments.filter((entry) => entry.assignment.status === 'completed'),
    [assignments],
  );

  useEffect(() => {
    console.info('[learner-surveys] surveyListRenderedCount', {
      renderedTotal: assignments.length,
      renderedActive: pendingAssignments.length,
      renderedCompleted: completedAssignments.length,
    });
  }, [assignments.length, pendingAssignments.length, completedAssignments.length]);

  useEffect(() => {
    if (!loading && !error && assignments.length === 0) {
      console.info('[learner-surveys] surveyListEmptyStateShown', {
        route: location.pathname,
      });
    }
  }, [assignments.length, error, loading, location.pathname]);

  const totalOverdue = assignments.filter((entry) => {
    const due = describeDueDate(entry.assignment.dueDate);
    return due.overdue && entry.assignment.status !== 'completed';
  }).length;

  const handleOpenSurvey = (entry: LearnerSurveyAssignment) => {
    const surveyId = getEntrySurveyId(entry);
    console.info('[learner-surveys] surveyOpenStarted', {
      assignmentId: entry.assignment.id,
      surveyId,
      status: entry.assignment.status,
    });

    if (surveyId && entry.assignment.status === 'completed') {
      navigate(`${portalPath}/surveys/${surveyId}/results?assignmentId=${entry.assignment.id}`);
      return;
    }

    if (surveyId) {
      navigate(`${portalPath}/surveys/${surveyId}/take?assignmentId=${entry.assignment.id}`);
      return;
    }

    const surveyUrl = extractSurveyLink(entry.assignment);
    if (surveyUrl) {
      window.open(surveyUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    console.error('[learner-surveys] surveyOpenFailed', {
      assignmentId: entry.assignment.id,
      reason: 'missing_survey_identifier',
    });
    const params = new URLSearchParams({ assignment: entry.assignment.id });
    navigate(`${portalPath}/surveys?${params.toString()}`);
  };

  const renderSurveyCard = (entry: LearnerSurveyAssignment) => {
    const { assignment, survey } = entry;
    const due = describeDueDate(assignment.dueDate);
    const highlight = assignment.id === highlightAssignmentId;
    const surveyUrl = extractSurveyLink(assignment);
    return (
      <div
        key={assignment.id}
        id={`survey-assignment-${assignment.id}`}
        className={`rounded-2xl border border-slate/20 bg-white/90 p-4 shadow-sm transition ${
          highlight ? 'ring-2 ring-skyblue/70 ring-offset-2 ring-offset-white' : ''
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-heading text-base font-semibold text-charcoal">
              {getEntrySurveyTitle(entry)}
            </p>
            <p className="text-xs text-slate/70">{due.label}</p>
          </div>
          <Badge tone={deriveStatusTone(assignment.status, due.overdue)}>
            {statusLabel(assignment.status)}
          </Badge>
        </div>
        {getEntrySurveyDescription(entry) && (
          <p className="mt-2 text-sm text-slate/70 line-clamp-3">{getEntrySurveyDescription(entry)}</p>
        )}
        {!survey && (
          <p className="mt-2 text-sm text-amber-700">
            Survey details are syncing. You can still open this assignment.
          </p>
        )}
        {assignment.note && (
          <p className="mt-2 text-sm text-slate/70 italic">{assignment.note}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate/70">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            {due.label}
          </span>
          {assignment.assignedBy && (
            <span className="inline-flex items-center gap-1">
              Assigned by {assignment.assignedBy}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button size="sm" onClick={() => handleOpenSurvey(entry)}>
            {assignment.status === 'completed' ? 'Review submission' : 'Open survey'}
          </Button>
          {assignment.status === 'completed' && survey?.id && (
            <>
              <Button size="sm" variant="ghost" asChild>
                <Link to={`${portalPath}/surveys/${survey.id}/results?assignmentId=${assignment.id}`}>
                  View report
                </Link>
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to={`${portalPath}/surveys/${survey.id}/progress?assignmentId=${assignment.id}`}>
                  View progress
                </Link>
              </Button>
            </>
          )}
          {surveyUrl && (
            <Button size="sm" variant="ghost" asChild>
              <a href={surveyUrl} target="_blank" rel="noreferrer">
                Launch external link
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <SEO title="My Surveys" description="View and complete assigned surveys." />
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: `${portalPath}/dashboard` },
          { label: 'Surveys', to: `${portalPath}/surveys` },
        ]}
      />
      <Card tone="muted" className="flex flex-wrap items-center justify-between gap-4" padding="lg">
        <div>
          <h1 className="font-heading text-2xl font-bold text-charcoal">My Surveys</h1>
          <p className="text-sm text-slate/70">
            Keep up with culture check-ins, readiness polls, and leadership diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone="info">{pendingAssignments.length} active</Badge>
          {totalOverdue > 0 && <Badge tone="danger">{totalOverdue} overdue</Badge>}
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" text="Loading surveys…" />
        </div>
      ) : error ? (
        <Card tone="muted" className="space-y-3 text-center" padding="lg">
          <p className="text-sm text-slate/70">{error}</p>
          <div className="flex justify-center">
            <Button onClick={() => void refresh()}>Retry</Button>
          </div>
        </Card>
      ) : assignments.length === 0 ? (
        <Card tone="muted" className="space-y-3 text-center" padding="lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cloud text-slate/70">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h2 className="font-heading text-lg font-semibold text-charcoal">No surveys assigned</h2>
          <p className="text-sm text-slate/70">You don’t have any surveys yet. Check back later.</p>
          <Button variant="ghost" asChild>
            <Link to={`${portalPath}/dashboard`}>← Back to dashboard</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-charcoal">Active surveys</h2>
              <Badge tone="info">{pendingAssignments.length}</Badge>
            </div>
            {pendingAssignments.length === 0 ? (
              <Card tone="muted" padding="md">
                <p className="text-sm text-slate/70">You’re all caught up. New surveys will appear here.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingAssignments.map(renderSurveyCard)}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-charcoal">Completed surveys</h2>
              <Badge tone="positive">{completedAssignments.length}</Badge>
            </div>
            {completedAssignments.length === 0 ? (
              <Card tone="muted" padding="md">
                <p className="text-sm text-slate/70">No submitted surveys yet. Completed surveys will show here.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {completedAssignments.map(renderSurveyCard)}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default ClientSurveys;
