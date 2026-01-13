import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Send, AlertTriangle, ShieldCheck, WifiOff } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { courseStore } from '../../store/courseStore';
import { useToast } from '../../context/ToastContext';
import { useSyncService } from '../../dal/sync';
import type { CourseAssignment } from '../../types/assignment';
import useRuntimeStatus from '../../hooks/useRuntimeStatus';
import { submitAssignmentRequest, subscribeToAssignmentQueue } from '../../utils/assignmentQueue';
import type { AssignmentQueueItem } from '../../utils/assignmentQueue';
import { useSecureAuth } from '../../context/SecureAuthContext';

const AdminCourseAssign = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const syncService = useSyncService();
  const runtimeStatus = useRuntimeStatus();
  const { activeOrgId, user } = useSecureAuth();
  const supabaseReady = runtimeStatus.supabaseConfigured && runtimeStatus.supabaseHealthy;
  const runtimeLastChecked = runtimeStatus.lastChecked
    ? new Date(runtimeStatus.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'pending';

  const course = useMemo(() => (courseId ? courseStore.getCourse(courseId) : null), [courseId]);

  const [emails, setEmails] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [queueItems, setQueueItems] = useState<AssignmentQueueItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAssignmentQueue((items) => setQueueItems(items));
    return () => unsubscribe();
  }, []);

  const hasQueuedRequests = queueItems.length > 0;
  const queuePreview = hasQueuedRequests ? queueItems.slice(0, 4) : [];

  if (!course) {
    return (
      <Card tone="muted" className="flex flex-col items-start gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sunrise/10 text-sunrise">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-semibold text-charcoal">Course not found</h2>
          <p className="mt-2 text-sm text-slate/80">
            Choose another course to assign from the course list.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/courses')}>
          Back to courses
        </Button>
      </Card>
    );
  }

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    const assignees = emails
      .split(/[\n,]/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (assignees.length === 0) {
      showToast('Add at least one email or user ID','error');
      return;
    }

    const organizationId = course.organizationId || activeOrgId || null;
    if (!organizationId) {
      showToast('Set an active organization before assigning this course.','error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitAssignmentRequest({
        courseId: course.id,
        organizationId,
        userIds: assignees,
        dueDate: dueDate || null,
        note: note || null,
        assignedBy: user?.id ?? user?.email ?? null,
        mode: 'learners',
        metadata: {
          surface: 'admin_course_assign',
          courseTitle: course.title,
          manualEntryCount: assignees.length,
        },
      });

      courseStore.saveCourse({
        ...course,
        enrollments: (course.enrollments || 0) + result.count,
        lastUpdated: new Date().toISOString(),
      }, { skipRemoteSync: true });

      (result.assignments ?? []).forEach((record: CourseAssignment) => {
        syncService.logEvent({
          type: 'assignment_created',
          data: record,
          timestamp: Date.now(),
          courseId: record.courseId,
          userId: record.userId,
          source: 'admin',
        });
        (syncService.logEvent as any)({
          type: 'course_assigned',
          data: record,
          timestamp: Date.now(),
        });
      });

      const toastMessage = result.status === 'queued'
        ? `Assignments queued for ${result.count} learner${result.count === 1 ? '' : 's'}. We'll sync them when the connection returns.`
        : `Assigned to ${result.count} learner${result.count === 1 ? '' : 's'}.`;
      showToast(toastMessage, 'success');
      setEmails('');
      setNote('');
      setDueDate('');
      navigate('/admin/courses');
    } catch (error) {
      console.error(error);
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      showToast(offline ? 'Assignments saved locally. We will retry once you are back online.' : 'Unable to assign course right now','error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card tone="muted" className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sunrise via-skyblue to-forest text-white">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <Badge tone="info" className="mb-2 bg-skyblue/10 text-skyblue">
              Assign Course
            </Badge>
            <h1 className="font-heading text-3xl font-bold text-charcoal">Share “{course.title}” with learners</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate/80">
              Enter email addresses or user IDs to invite learners. Assignments sync to analytics so you can track progress.
            </p>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 text-sm ${supabaseReady ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              {supabaseReady ? (
                <span className="rounded-xl bg-white/70 p-2 text-emerald-600 shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </span>
              ) : (
                <span className="rounded-xl bg-white/70 p-2 text-amber-600 shadow-sm">
                  <WifiOff className="h-5 w-5" />
                </span>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide">
                  {supabaseReady ? 'Secure mode connected' : runtimeStatus.demoModeEnabled ? 'Demo mode active' : 'Supabase offline'}
                </p>
                <p className="mt-1 text-sm leading-relaxed">
                  {supabaseReady
                    ? 'Learners will receive notifications immediately and their progress updates in analytics.'
                    : runtimeStatus.demoModeEnabled
                      ? 'Assignments are stored locally until Supabase returns. Export the list if you need to share manually.'
                      : 'We are queueing assignments and will sync them automatically once the health check succeeds again.'}
                </p>
                {!supabaseReady && runtimeStatus.lastError && (
                  <p className="mt-2 text-xs opacity-80">Last error: {runtimeStatus.lastError}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${supabaseReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                Runtime: {runtimeStatus.statusLabel}
              </span>
              <span className="text-xs opacity-80">Last health check {runtimeLastChecked}</span>
            </div>
          </div>
        </div>

          {hasQueuedRequests && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {queueItems.length} assignment request{queueItems.length === 1 ? '' : 's'} waiting to sync
                  </p>
                  <p className="mt-1 text-xs">We'll resend them once connectivity returns.</p>
                </div>
                <WifiOff className="h-5 w-5 text-amber-600" />
              </div>
              <ul className="mt-3 space-y-1 text-xs">
                {queuePreview.map((item) => {
                  const targetCount = item.userIds.length || 1;
                  const targetLabel = item.mode === 'organization'
                    ? 'Organization assignment'
                    : `${targetCount} learner${targetCount === 1 ? '' : 's'}`;
                  return (
                    <li key={item.id} className="flex items-center justify-between text-amber-800">
                      <span className="font-medium">{targetLabel}</span>
                      <span className="capitalize">{item.status}</span>
                    </li>
                  );
                })}
                {queueItems.length > queuePreview.length && (
                  <li className="text-amber-800">
                    +{queueItems.length - queuePreview.length} more pending request{queueItems.length - queuePreview.length === 1 ? '' : 's'}
                  </li>
                )}
              </ul>
            </div>
          )}

        <form onSubmit={handleAssign} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-charcoal">Learner emails or IDs *</label>
            <p className="text-xs text-slate/70">Separate multiple entries with commas or line breaks.</p>
            <textarea
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              className="mt-2 h-32 w-full rounded-xl border border-mist px-4 py-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-skyblue focus:ring-offset-2 focus:ring-offset-softwhite"
              placeholder="mya@thehuddleco.com&#10;team@inclusive.org"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-charcoal">Due date (optional)</label>
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal">Notes to learners</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-2 h-24 w-full rounded-xl border border-mist px-4 py-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-skyblue focus:ring-offset-2 focus:ring-offset-softwhite"
                placeholder="Highlight key outcomes or include login instructions."
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="sm" disabled={submitting} leadingIcon={<Send className="h-4 w-4" />}>
              {submitting ? 'Assigning…' : 'Assign course'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/courses')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AdminCourseAssign;
