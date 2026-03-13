import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Loader2,
  Search,
  Send,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';
import { courseStore } from '../store/courseStore';
import type { CourseAssignment } from '../types/assignment';
import orgService from '../dal/orgs';
import useRuntimeStatus from '../hooks/useRuntimeStatus';
import { submitAssignmentRequest, subscribeToAssignmentQueue } from '../utils/assignmentQueue';
import type { AssignmentQueueItem, AssignmentRequestMode } from '../utils/assignmentQueue';
import { useSecureAuth } from '../context/SecureAuthContext';
import adminUsers, { AdminUserRecord } from '../dal/adminUsers';

interface CourseAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: string[];
  course?: { id: string; title: string; duration?: string; organizationId?: string | null };
  onAssignComplete?: (assignmentData?: CourseAssignment[]) => void;
}

interface OrgOption {
  id: string;
  name: string;
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
  const { user } = useSecureAuth();
  const supabaseReady = runtimeStatus.supabaseConfigured && runtimeStatus.supabaseHealthy;
  const runtimeLastChecked = runtimeStatus.lastChecked
    ? new Date(runtimeStatus.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'pending';

  const [loading, setLoading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(course?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [organizationOptions, setOrganizationOptions] = useState<OrgOption[]>([]);
  const [orgListLoading, setOrgListLoading] = useState(false);
  const [orgListError, setOrgListError] = useState<string | null>(null);
  const [orgSearch, setOrgSearch] = useState('');
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [orgMembers, setOrgMembers] = useState<Record<string, AdminUserRecord[]>>({});
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [queueItems, setQueueItems] = useState<AssignmentQueueItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAssignmentQueue((items) => setQueueItems(items));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setSelectedCourseId(course?.id ?? '');
  }, [course?.id]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedOrgIds([]);
      setSelectedUserIds([]);
      setOrgSearch('');
      setUserSearch('');
      setUsersError(null);
      setNote('');
      setDueDate('');
      return;
    }
    if (selectedUsers.length > 0) {
      setSelectedUserIds(selectedUsers);
    }
  }, [isOpen, selectedUsers]);

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
        organizationId: entry.organizationId,
      };
    });
  }, [course, isOpen]);

  const resolvedCourse = useMemo(() => {
    if (course?.id) {
      return courseStore.getCourse(course.id) ?? course;
    }
    if (selectedCourseId) {
      return courseStore.getCourse(selectedCourseId) ?? availableCourses.find((c) => c.id === selectedCourseId);
    }
    return null;
  }, [course, selectedCourseId, availableCourses]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    (async () => {
      try {
        setOrgListLoading(true);
        setOrgListError(null);
        const orgs = await orgService.listOrgs();
        if (!active) return;
        const normalized = Array.isArray(orgs)
          ? orgs
              .filter((org: any) => org?.id)
              .map((org: any) => ({ id: String(org.id), name: org.name || `Org ${org.id}` }))
          : [];
        setOrganizationOptions(normalized);
        if (
          normalized.length > 0 &&
          selectedOrgIds.length === 0 &&
          resolvedCourse &&
          'organizationId' in resolvedCourse &&
          resolvedCourse.organizationId
        ) {
          setSelectedOrgIds([String(resolvedCourse.organizationId)]);
        }
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
  }, [isOpen, resolvedCourse, selectedOrgIds.length]);

  const fetchOrgMembers = useCallback(
    async (orgId: string) => {
      try {
        const users = await adminUsers.listUsersByOrg(orgId);
        setOrgMembers((prev) => ({ ...prev, [orgId]: users }));
      } catch (error) {
        console.error('[CourseAssignmentModal] Failed to load users for org', orgId, error);
        setUsersError('Unable to load users for one or more organizations');
      }
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) return;
    const missing = selectedOrgIds.filter((orgId) => !orgMembers[orgId]);
    if (missing.length === 0) {
      setUsersLoading(false);
      return;
    }
    let cancelled = false;
    setUsersLoading(true);
    setUsersError(null);
    Promise.all(missing.map((orgId) => fetchOrgMembers(orgId))).finally(() => {
      if (!cancelled) {
        setUsersLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedOrgIds, orgMembers, fetchOrgMembers, isOpen]);

  const filteredOrganizations = useMemo(() => {
    const term = orgSearch.trim().toLowerCase();
    if (!term) return organizationOptions;
    return organizationOptions.filter((org) => org.name.toLowerCase().includes(term));
  }, [organizationOptions, orgSearch]);

  const userIndex = useMemo(() => {
    const map = new Map<string, AdminUserRecord>();
    selectedOrgIds.forEach((orgId) => {
      const members = orgMembers[orgId];
      if (!members) return;
      members.forEach((member) => {
        const key = member.userId;
        if (!key || map.has(key)) return;
        map.set(key, member);
      });
    });
    return map;
  }, [selectedOrgIds, orgMembers]);

  const availableUsers = useMemo(() => {
    const list = Array.from(userIndex.values());
    if (!userSearch.trim()) return list;
    const term = userSearch.trim().toLowerCase();
    return list.filter((user) => {
      const fields = [user.name, user.email, user.title];
      return fields.some((field) => field && field.toLowerCase().includes(term));
    });
  }, [userIndex, userSearch]);

  const unresolvedSelectedUsers = useMemo(() => {
    return selectedUserIds.filter((userId) => !userIndex.has(userId));
  }, [selectedUserIds, userIndex]);

  const resolvedSelectedUsers = useMemo(() => {
    return selectedUserIds.filter((userId) => userIndex.has(userId));
  }, [selectedUserIds, userIndex]);

  const hasQueuedRequests = queueItems.length > 0;
  const queuePreview = hasQueuedRequests ? queueItems.slice(0, 3) : [];

  const toggleOrgSelection = (orgId: string) => {
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  };

  const handleUserSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    setSelectedUserIds(values);
  };

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();

    const targetCourseId = course?.id ?? selectedCourseId;
    if (!targetCourseId) {
      showToast('Select a course before assigning.', 'error');
      return;
    }

    const userGroups = new Map<string, string[]>();
    resolvedSelectedUsers.forEach((userId) => {
      const record = userIndex.get(userId);
      if (!record || !record.orgId) return;
      if (!userGroups.has(record.orgId)) {
        userGroups.set(record.orgId, []);
      }
      userGroups.get(record.orgId)!.push(userId);
    });

    const filteredUserGroups = Array.from(userGroups.entries()).filter(
      ([orgId]) => !selectedOrgIds.includes(orgId)
    );

    const hasOrgTargets = selectedOrgIds.length > 0;
    const hasUserTargets = filteredUserGroups.length > 0;

    if (!hasOrgTargets && !hasUserTargets) {
      showToast('Select at least one organization or learner.', 'error');
      return;
    }

    setLoading(true);
    const assignmentPayloads: CourseAssignment[] = [];

    try {
      const runAssignment = async (
        orgId: string,
        mode: AssignmentRequestMode,
        userIds: string[]
      ) => {
        const result = await submitAssignmentRequest({
          courseId: targetCourseId,
          organizationId: orgId,
          userIds,
          dueDate: dueDate || null,
          note: note || null,
          assignedBy: user?.id ?? user?.email ?? null,
          mode,
          metadata: {
            surface: 'course_assignment_modal',
            orgCount: selectedOrgIds.length,
            userCount: resolvedSelectedUsers.length,
            queuedAt: new Date().toISOString(),
          },
        });
        if (result.assignments?.length) {
          assignmentPayloads.push(...result.assignments);
        }
        console.info('[CourseAssignmentModal] assign_request_success', {
          courseId: targetCourseId,
          orgId,
          mode,
          userCount: userIds.length,
          status: result.status,
        });
        return result.status;
      };

      const statuses: Array<'sent' | 'queued'> = [];
      for (const orgId of selectedOrgIds) {
        statuses.push(await runAssignment(orgId, 'organization', []));
      }
      for (const [orgId, userIds] of filteredUserGroups) {
        statuses.push(await runAssignment(orgId, 'learners', userIds));
      }

      const queuedCount = statuses.filter((status) => status === 'queued').length;
      const successMessage = queuedCount > 0
        ? `Assignments queued for ${selectedOrgIds.length} org(s) and ${resolvedSelectedUsers.length} learner(s). We'll sync them when the connection recovers.`
        : `Assignments sent to ${selectedOrgIds.length} org(s) and ${resolvedSelectedUsers.length} learner(s).`;
      showToast(successMessage, 'success');
      console.info('[CourseAssignmentModal] assign_success', {
        courseId: targetCourseId,
        orgCount: selectedOrgIds.length,
        userCount: resolvedSelectedUsers.length,
      });
      onAssignComplete?.(assignmentPayloads);
      setSelectedUserIds([]);
      setSelectedOrgIds([]);
      setDueDate('');
      setNote('');
      onClose();
    } catch (error) {
      console.error('[CourseAssignmentModal] assign_failed', {
        courseId: course?.id ?? selectedCourseId,
        orgCount: selectedOrgIds.length,
        userCount: resolvedSelectedUsers.length,
        error,
      });
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      showToast(
        offline
          ? 'We queued your assignments offline. Keep the tab open so we can retry.'
          : 'We hit a snag assigning this course. Please try again.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredOrgSelections = filteredOrganizations.slice(0, 50); // safety for very large org lists

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <BookOpen className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Assign Course</h2>
              <p className="text-sm text-gray-600">
                Choose one or more organizations and specific learners. We'll route assignments through the admin API.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            disabled={loading}
            aria-label="Close course assignment modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleAssign} className="p-6 space-y-6">
          <div
            className={`rounded-xl border p-4 text-sm ${supabaseReady ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                {supabaseReady ? (
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-green-600" />
                ) : (
                  <WifiOff className="h-5 w-5 mt-0.5 text-amber-600" />
                )}
                <div>
                  <p className="font-semibold">
                    {supabaseReady ? 'Assignments deliver immediately' : runtimeStatus.demoModeEnabled ? 'Demo mode: assignments stay local' : 'Supabase offline: assignments queued'}
                  </p>
                  <p className="mt-1 leading-relaxed">
                    {supabaseReady
                      ? 'Learners and org workspaces receive notifications as soon as you assign.'
                      : runtimeStatus.demoModeEnabled
                        ? 'You can stage assignments, but they remain local until Supabase is re-enabled.'
                        : 'Assignments persist locally and auto-sync once runtime health checks pass.'}
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

          {course ? (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Assigning <span className="font-semibold text-gray-900">{course.title}</span>
              {course.duration && <span className="ml-1">({course.duration})</span>}
            </div>
          ) : (
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Organizations *</label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="Search organizations"
                  className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={orgListLoading}
                />
              </div>
            </div>
            {orgListLoading ? (
              <div className="flex items-center space-x-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading organizations…
              </div>
            ) : orgListError ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4" />
                {orgListError}. Refresh and try again.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-3 space-y-2">
                {filteredOrgSelections.length === 0 && (
                  <p className="text-sm text-gray-500">No organizations match your search.</p>
                )}
                {filteredOrgSelections.map((org) => (
                  <label
                    key={org.id}
                    className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 hover:border-gray-300"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedOrgIds.includes(org.id)}
                        onChange={() => toggleOrgSelection(org.id)}
                        className="h-4 w-4 text-green-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{org.name}</p>
                        <p className="text-xs text-gray-500">ID: {org.id}</p>
                      </div>
                    </div>
                    {selectedOrgIds.includes(org.id) && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">Selecting an organization assigns the course to all active members.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Specific learners</label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Filter learners by name or email"
                  className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={usersLoading || selectedOrgIds.length === 0}
                />
              </div>
            </div>
            {selectedOrgIds.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                Choose at least one organization above to load its members.
              </div>
            ) : usersLoading ? (
              <div className="flex items-center space-x-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading learners…
              </div>
            ) : availableUsers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                No learners found for the selected organization(s).
              </div>
            ) : (
              <select
                multiple
                value={selectedUserIds}
                onChange={handleUserSelectionChange}
                className="w-full min-h-[140px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {availableUsers.map((userOption) => (
                  <option key={userOption.userId} value={userOption.userId}>
                    {userOption.name || userOption.email || userOption.userId}
                    {userOption.email ? ` · ${userOption.email}` : ''}
                    {userOption.title ? ` · ${userOption.title}` : ''}
                  </option>
                ))}
              </select>
            )}
            {unresolvedSelectedUsers.length > 0 && (
              <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {unresolvedSelectedUsers.length} selected ID(s) aren't part of the loaded organizations yet.
              </p>
            )}
            {selectedOrgIds.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                Learner selections inside organizations you already selected are skipped automatically to avoid duplicates.
              </p>
            )}
          </div>

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
                <h4 className="font-medium text-blue-900">Assignment details</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Entire organizations receive assignments instantly. Learner selections target specific people, perfect for pilot groups or follow-ups.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-sm text-gray-600">
            <span>{selectedOrgIds.length} organization(s) selected</span>
            <span>{resolvedSelectedUsers.length} learner(s) selected</span>
          </div>

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
