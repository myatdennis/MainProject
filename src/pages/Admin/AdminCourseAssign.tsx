import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Send, AlertTriangle, ShieldCheck, WifiOff } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { courseStore } from '../../store/courseStore';
import { useToast } from '../../context/ToastContext';
import { useSyncService } from '../../dal/sync';
import { addAssignments } from '../../utils/assignmentStorage';
import type { CourseAssignment } from '../../types/assignment';
import useRuntimeStatus from '../../hooks/useRuntimeStatus';

const AdminCourseAssign = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const syncService = useSyncService();
  const runtimeStatus = useRuntimeStatus();
  const supabaseReady = runtimeStatus.supabaseConfigured && runtimeStatus.supabaseHealthy;
  const runtimeLastChecked = runtimeStatus.lastChecked
    ? new Date(runtimeStatus.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'pending';

  const course = useMemo(() => (courseId ? courseStore.getCourse(courseId) : null), [courseId]);

  const [emails, setEmails] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
    try {
      const assignments = await addAssignments(course.id, assignees, { dueDate, note });

      courseStore.saveCourse({
        ...course,
        enrollments: (course.enrollments || 0) + assignments.length,
        lastUpdated: new Date().toISOString(),
      }, { skipRemoteSync: true });

      assignments.forEach((record: CourseAssignment) => {
        syncService.logEvent({
          type: 'assignment_created',
          data: record,
          timestamp: Date.now(),
          courseId: record.courseId,
          userId: record.userId,
          source: 'admin',
        });
        // Log a secondary event for UX hooks; cast to any to allow custom event type without widening core union
        (syncService.logEvent as any)({
          type: 'course_assigned',
          data: record,
          timestamp: Date.now(),
        });
      });

      showToast(`Assigned to ${assignments.length} learner(s)`, 'success');
      navigate('/admin/courses');
    } catch (error) {
      console.error(error);
      showToast('Unable to assign course right now','error');
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
