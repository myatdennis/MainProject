import React, { useEffect, useMemo, useState } from 'react';
import { X, BookOpen, Users, Send, Building2, Loader2, ShieldCheck, WifiOff } from 'lucide-react';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';
import { courseStore } from '../store/courseStore';
import type { CourseAssignment } from '../types/assignment';
import orgService from '../dal/orgs';
import useRuntimeStatus from '../hooks/useRuntimeStatus';
import { submitAssignmentRequest, subscribeToAssignmentQueue } from '../utils/assignmentQueue';
import type { AssignmentQueueItem } from '../utils/assignmentQueue';
import { useSecureAuth } from '../context/SecureAuthContext';

interface CourseAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: string[];
  course?: { id: string; title: string; duration?: string };
  onAssignComplete?: (assignmentData?: CourseAssignment[]) => void;
}

const CourseAssignmentModal: React.FC<CourseAssignmentModalProps> = ({
  isOpen,
  onClose,
  selectedUsers,
  course,
  onAssignComplete,
}) => {
  const { showToast } = useToast();
  const runtimeStatus = useRuntimeStatus();
  const { user, activeOrgId } = useSecureAuth();
  const supabaseReady = runtimeStatus.supabaseConfigured && runtimeStatus.supabaseHealthy;
  const runtimeLastChecked = runtimeStatus.lastChecked
    ? new Date(runtimeStatus.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'pending';
  const [loading, setLoading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(course?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [emailList, setEmailList] = useState(selectedUsers.join('\n'));
  const [assignmentMode, setAssignmentMode] = useState<'learners' | 'organization'>('learners');
  const [organizationOptions, setOrganizationOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [orgListLoading, setOrgListLoading] = useState(false);
  const [orgListError, setOrgListError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [queueItems, setQueueItems] = useState<AssignmentQueueItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAssignmentQueue((items) => setQueueItems(items));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setSelectedCourseId(course?.id ?? '');
  }, [course?.id]);

  useEffect(() => {
    setEmailList((prev) => {
      if (!isOpen) return prev;
      return selectedUsers.join('\n');
    });
  }, [selectedUsers, isOpen]);

  const availableCourses = useMemo(() => {
    if (course) {
      return [course];
    }
    return courseStore.getAllCourses().map((entry) => {
      const durationLabel = entry.duration || (entry.estimatedDuration ? `${entry.estimatedDuration} min` : '');
      return {
        id: entry.id,
        title: entry.title,
        duration: durationLabel,
      };
    });
  }, [course, isOpen]);

  const resolvedCourse = useMemo(() => {
    if (course?.id) {
      return courseStore.getCourse(course.id) ?? course;
    }
    if (selectedCourseId) {
      return courseStore.getCourse(selectedCourseId);
    }
    return null;
  }, [course, selectedCourseId]);

  const resolvedCourseOrgId = resolvedCourse && 'organizationId' in resolvedCourse
    ? resolvedCourse.organizationId ?? null
    : null;

  useEffect(() => {
    if (!isOpen) {
      setAssignmentMode('learners');
      setSelectedOrgId('');
      return;
    }

    let active = true;
    (async () => {
      try {
        setOrgListLoading(true);
        setOrgListError(null);
        const orgs = await orgService.listOrgs();
        if (!active) return;
        const normalized = orgs
          .filter((org: any) => org?.id)
          .map((org: any) => ({ id: String(org.id), name: org.name || `Org ${org.id}` }));
        setOrganizationOptions(normalized);
      } catch (error) {
        if (!active) return;
        console.error('[CourseAssignmentModal] Failed to load organizations:', error);
        setOrgListError('Unable to load organizations');
        setOrganizationOptions([]);
      } finally {
        if (active) {
          setOrgListLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [isOpen]);

  const selectedOrganization = useMemo(() => {
    return organizationOptions.find((org) => org.id === selectedOrgId) ?? null;
  }, [organizationOptions, selectedOrgId]);

  const hasQueuedRequests = queueItems.length > 0;
  const queuePreview = hasQueuedRequests ? queueItems.slice(0, 3) : [];

  if (!isOpen) return null;

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();

    const targetCourseId = course?.id ?? selectedCourseId;
    if (!targetCourseId) {
      showToast('Pick a course before sending Huddle invites.', 'error');
      return;
    }

    let recipients: string[] = [];
    if (assignmentMode === 'learners') {
      recipients = emailList
        .split(/\n|,|;/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

      if (recipients.length === 0) {
        showToast('Add at least one email or user ID', 'error');
        return;
      }
    }

    const candidateOrgId = assignmentMode === 'organization'
      ? selectedOrgId
      : resolvedCourseOrgId || activeOrgId || selectedOrgId || '';
    const resolvedOrgId = `${candidateOrgId}`.trim();

    if (!resolvedOrgId) {
      showToast('Select an organization or set your active workspace before assigning this course.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await submitAssignmentRequest({
        courseId: targetCourseId,
  organizationId: resolvedOrgId,
        userIds: assignmentMode === 'organization' ? [] : recipients,
        dueDate: dueDate || null,
        note: note || null,
        assignedBy: user?.id ?? user?.email ?? null,
        mode: assignmentMode,
        metadata: {
          surface: 'course_assignment_modal',
          selectedUserCount: selectedUsers.length,
          manualEntryCount: recipients.length,
          organizationMode: assignmentMode,
          organizationLabel: selectedOrganization?.name ?? resolvedOrgId,
        },
      });

      const audienceLabel = assignmentMode === 'organization'
        ? selectedOrganization?.name ?? 'this organization'
        : `${result.count} learner${result.count === 1 ? '' : 's'}`;

      const toastMessage = result.status === 'queued'
        ? `Assignments queued for ${audienceLabel}. We'll sync them automatically once we're back online.`
        : `Assignments sent to ${audienceLabel}. Learners will see notifications shortly.`;

      showToast(toastMessage, 'success');
      onAssignComplete?.(result.assignments);

      if (assignmentMode === 'learners') {
        setEmailList('');
        if (!course) {
          setSelectedCourseId('');
        }
      } else {
        setSelectedOrgId('');
      }
      setNote('');
      setDueDate('');
      onClose();
    } catch (error) {
      console.error('[CourseAssignmentModal] Failed to assign course:', error);
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      showToast(
        offline
          ? 'Huddle can’t reach the network right now. Keep the tab open and we will retry automatically.'
          : 'We hit a snag assigning this course. Please try again in a moment.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <BookOpen className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Assign Course</h2>
              <p className="text-sm text-gray-600">
                {selectedUsers.length > 0
                  ? `Prefilled with ${selectedUsers.length} selected user(s)`
                  : 'Paste learner emails or IDs below'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAssign} className="p-6 space-y-6">
          <div
            className={`rounded-xl border p-4 text-sm ${supabaseReady ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                {supabaseReady ? (
                  <ShieldCheck className="h-5 w-5 mt-0.5 text-green-600" />
                ) : (
                  <WifiOff className="h-5 w-5 mt-0.5 text-amber-600" />
                )}
                <div>
                  <p className="font-semibold">
                    {supabaseReady ? 'Assignments deliver immediately' : runtimeStatus.demoModeEnabled ? 'Demo mode: assignments stay local' : 'Supabase offline: assignments queued'}
                  </p>
                  <p className="mt-1 leading-relaxed">
                    {supabaseReady
                      ? 'Learners and org workspaces will receive notifications and analytics updates as soon as you hit Assign.'
                      : runtimeStatus.demoModeEnabled
                        ? 'You can stage assignments, but they will remain local until Supabase is re-enabled. Use CSV export if sharing externally.'
                        : 'Assignments persist locally and will auto-sync once the runtime health check returns to OK. You will also see them inside Sync Diagnostics.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${supabaseReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  Runtime: {runtimeStatus.statusLabel}
                </span>
                <span className="text-xs opacity-80">Last health check {runtimeLastChecked}</span>
              </div>
            </div>
          </div>
          {hasQueuedRequests && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {queueItems.length} assignment request{queueItems.length === 1 ? '' : 's'} waiting to sync
                  </p>
                  <p className="mt-1 text-xs">
                    We'll resend them automatically once connectivity returns.
                  </p>
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
          {!course && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select course *</label>
              <select
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
                disabled={loading}
              >
                <option value="">Choose a course...</option>
                {availableCourses.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title} {entry.duration ? `(${entry.duration})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {course && (
            <div className="rounded-lg border border-mist bg-softwhite/60 px-4 py-3 text-sm text-slate/80">
              Assigning <span className="font-semibold text-charcoal">{course.title}</span>
              {course.duration && <span className="ml-1">({course.duration})</span>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assignment method</label>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm font-medium">
              <button
                type="button"
                onClick={() => setAssignmentMode('learners')}
                className={`rounded-md px-3 py-1.5 transition ${assignmentMode === 'learners' ? 'bg-white text-charcoal shadow-sm' : 'text-gray-500'}`}
                disabled={loading}
              >
                Learner emails
              </button>
              <button
                type="button"
                onClick={() => setAssignmentMode('organization')}
                className={`rounded-md px-3 py-1.5 transition ${assignmentMode === 'organization' ? 'bg-white text-charcoal shadow-sm' : 'text-gray-500'}`}
                disabled={loading}
              >
                Organization
              </button>
            </div>
          </div>

          {assignmentMode === 'organization' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Choose organization *</label>
              {orgListLoading ? (
                <div className="flex items-center space-x-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading organizations…
                </div>
              ) : (
                <select
                  value={selectedOrgId}
                  onChange={(event) => setSelectedOrgId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={loading || organizationOptions.length === 0}
                  required
                >
                  <option value="">Select an organization…</option>
                  {organizationOptions.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              )}
              {orgListError && (
                <p className="mt-1 text-xs text-red-600">{orgListError}. Refresh and try again.</p>
              )}
              {assignmentMode === 'organization' && !orgListLoading && organizationOptions.length === 0 && !orgListError && (
                <p className="mt-1 text-xs text-gray-500">Add an organization first from the Admin → Organizations page.</p>
              )}
              {selectedOrganization && (
                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4" />
                    <span>
                      {selectedOrganization.name} will receive this course via their organization workspace.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {assignmentMode === 'learners' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Learner emails or IDs *</label>
              <textarea
                value={emailList}
                onChange={(event) => setEmailList(event.target.value)}
                placeholder="team@inclusive.org\nlearner@huddle.co"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={5}
                required
                disabled={loading}
              />
              <p className="mt-1 text-xs text-slate/70">Separate multiple entries with commas or line breaks.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Due date (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Note to learners</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={3}
                disabled={loading}
              />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <Users className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">Assignment Details</h4>
                <p className="text-sm text-blue-700 mt-1">
                  {assignmentMode === 'organization'
                    ? 'Org members receive notifications immediately, and their progress syncs with analytics.'
                    : 'Learners receive notifications immediately. Progress syncs with analytics and the client portal dashboard.'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              disabled={loading}
            >
              Cancel
            </button>
            <LoadingButton type="submit" loading={loading} variant="success">
              <Send className="h-4 w-4" />
              Assign course
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseAssignmentModal;