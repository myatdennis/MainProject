import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCcw, Users, ClipboardList, AlertCircle } from 'lucide-react';
import type { CourseAssignment } from '../types/assignment';
import orgService from '../dal/orgs';
import { fetchCourseAssignments } from '../dal/adminCourses';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';

interface AdminCourseAssignmentsPanelProps {
  courseId?: string;
  defaultOrgId?: string | null;
  refreshToken?: number;
}

interface OrgOption {
  id: string;
  name: string;
}

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch (_error) {
    return value;
  }
};

const AdminCourseAssignmentsPanel = ({ courseId, defaultOrgId, refreshToken = 0 }: AdminCourseAssignmentsPanelProps) => {
  const { showToast } = useToast();
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const selectedOrgIdRef = useRef<string>('');

  const updateSelectedOrg = useCallback((value: string) => {
    selectedOrgIdRef.current = value;
    setSelectedOrgId(value);
  }, []);

  const loadOrganizations = useCallback(
    async (forceRefresh = false) => {
      setOrgsLoading(true);
      setOrgError(null);
      try {
        const orgs = await orgService.listOrgs(undefined, forceRefresh ? { forceRefresh: true } : undefined);
        const normalized: OrgOption[] = orgs.map((org) => ({
          id: String(org.id),
          name: org.name || `Org ${org.id}`,
        }));
        setOrgOptions(normalized);
        if (!selectedOrgIdRef.current) {
          const preferred = defaultOrgId && normalized.find((org) => org.id === defaultOrgId)?.id;
          if (preferred) {
            updateSelectedOrg(preferred);
          } else if (normalized[0]) {
            updateSelectedOrg(normalized[0].id);
          }
        }
      } catch (error) {
        console.error('[AdminCourseAssignmentsPanel] Failed to load organizations', error);
        setOrgError('Unable to load organizations');
        showToast('Unable to load organizations', 'error');
      } finally {
        setOrgsLoading(false);
      }
    },
    [defaultOrgId, showToast, updateSelectedOrg]
  );

  const loadAssignments = useCallback(
    async (orgId: string, opts: { silent?: boolean } = {}) => {
      if (!courseId || !orgId) return;
      setAssignmentsLoading(true);
      setAssignmentsError(null);
      try {
        const rows = await fetchCourseAssignments(courseId, orgId, { activeOnly: !showInactive });
        setAssignments(rows);
      } catch (error) {
        console.error('[AdminCourseAssignmentsPanel] Failed to load assignments', error);
        setAssignmentsError('Unable to load assignments');
        if (!opts.silent) {
          showToast('Unable to load assignments', 'error');
        }
      } finally {
        setAssignmentsLoading(false);
      }
    },
    [courseId, showInactive, showToast]
  );

  useEffect(() => {
    void loadOrganizations(false);
  }, [loadOrganizations]);

  useEffect(() => {
    if (courseId && selectedOrgId) {
      void loadAssignments(selectedOrgId, { silent: true });
    }
  }, [courseId, selectedOrgId, refreshToken, loadAssignments]);

  const summary = useMemo(() => {
    const total = assignments.length;
    const active = assignments.filter((assignment) => assignment.active !== false).length;
    const orgLevel = assignments.filter((assignment) => !assignment.userId).length;
    return { total, active, orgLevel };
  }, [assignments]);

  const renderAssignmentsTable = () => {
    if (!selectedOrgId) {
      return <p className="text-sm text-gray-600">Select an organization to view assignment records.</p>;
    }
    if (assignmentsLoading) {
      return <p className="text-sm text-gray-600">Loading assignments…</p>;
    }
    if (assignmentsError) {
      return <p className="text-sm text-red-600">{assignmentsError}</p>;
    }
    if (assignments.length === 0) {
      return <p className="text-sm text-gray-600">No assignments found for this organization.</p>;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Target</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Due</th>
              <th className="py-2 pr-4 font-medium">Note</th>
              <th className="py-2 pr-4 font-medium">Assigned By</th>
              <th className="py-2 pr-4 font-medium">Active</th>
              <th className="py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => {
              const targetLabel = assignment.userId ? assignment.userId : 'Entire organization';
              const statusLabel = assignment.status ? assignment.status.replace('-', ' ') : 'assigned';
              return (
                <tr key={assignment.id} className="border-t border-gray-100">
                  <td className="py-2 pr-4 text-gray-900">{targetLabel}</td>
                  <td className="py-2 pr-4 capitalize text-gray-700">{statusLabel}</td>
                  <td className="py-2 pr-4 text-gray-700">{formatDate(assignment.dueDate)}</td>
                  <td className="py-2 pr-4 text-gray-500">
                    {assignment.note ? assignment.note : '—'}
                  </td>
                  <td className="py-2 pr-4 text-gray-700">{assignment.assignedBy || '—'}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${assignment.active === false ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                      {assignment.active === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="py-2 text-gray-600">{formatDate(assignment.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <ClipboardList className="h-5 w-5 text-orange-500" /> Assignment activity
          </h2>
          <p className="text-sm text-gray-600">See which organizations or learners currently have this course.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LoadingButton variant="secondary" size="sm" onClick={() => loadOrganizations(true)} loading={orgsLoading} icon={RefreshCcw}>
            Refresh orgs
          </LoadingButton>
          <LoadingButton
            variant="secondary"
            size="sm"
            onClick={() => selectedOrgId && loadAssignments(selectedOrgId)}
            loading={assignmentsLoading}
            disabled={!selectedOrgId || assignmentsLoading}
            icon={RefreshCcw}
          >
            Refresh assignments
          </LoadingButton>
        </div>
      </div>

      {!courseId && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4" />
          <span>Save this course before viewing assignment history.</span>
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <label className="text-sm font-medium text-gray-700">Organization</label>
            <div className="flex-1">
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={selectedOrgId}
              onChange={(event) => updateSelectedOrg(event.target.value)}
              disabled={orgsLoading || !courseId}
            >
                <option value="">Select an organization…</option>
                {orgOptions.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              {orgError && <p className="mt-1 text-xs text-red-600">{orgError}</p>}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              disabled={assignmentsLoading}
            />
            Show inactive assignments
          </label>
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <div className="grid gap-4 text-sm text-gray-700 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
                <p className="text-lg font-semibold text-gray-900">{summary.total}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Active</p>
                <p className="text-lg font-semibold text-gray-900">{summary.active}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Org-level</p>
                <p className="text-lg font-semibold text-gray-900">{summary.orgLevel}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
          <div className="flex items-center gap-2 font-medium text-gray-900">
            <Users className="h-4 w-4 text-sky-500" /> Assignment tips
          </div>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Select an organization to inspect direct learner assignments.</li>
            <li>Org-level assignments appear with target “Entire organization”.</li>
            <li>Toggle inactive rows to audit historical assignments.</li>
          </ul>
        </div>
      </div>

      <div className="mt-6">
        {renderAssignmentsTable()}
      </div>
    </div>
  );
};

export default AdminCourseAssignmentsPanel;
