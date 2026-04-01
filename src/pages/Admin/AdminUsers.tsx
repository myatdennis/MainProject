/**
 * AdminUsers - Admin portal page for managing users, progress, and assignments.
 * Uses shared UI components and accessibility best practices.
 * Features: search/filter, bulk actions, modals, progress tracking, and summary stats.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  Download, 
  Upload,
  
  CheckCircle,
  Clock,
  AlertTriangle,
  Mail,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
} from 'lucide-react';
import AddUserModal from '../../components/AddUserModal';
import UserCsvImportModal from '../../components/Admin/UserCsvImportModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import CourseAssignmentModal from '../../components/CourseAssignmentModal';
import LoadingButton from '../../components/LoadingButton';
import { useToast } from '../../context/ToastContext';
import { User } from '../../types/user';
import type { CourseAssignment } from '../../types/assignment';
import PageWrapper from '../../components/PageWrapper';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import EmptyState from '../../components/ui/EmptyState';
import ActionsMenu from '../../components/ui/ActionsMenu';
import { listOrgs } from '../../dal/orgs';
import { listUsersByOrg } from '../../dal/adminUsers';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { LoadingSpinner } from '../../components/LoadingComponents';
import apiRequest from '../../utils/apiClient';
import { useRouteChangeReset } from '../../hooks/useRouteChangeReset';
import { useNavTrace } from '../../hooks/useNavTrace';

const AdminUsers = () => {
  useNavTrace('AdminUsers');
  const { activeOrgId } = useSecureAuth();
  const { routeKey } = useRouteChangeReset();

  // Reset transient UI state (filters, selections) whenever the user navigates
  // away from and back to this page so stale selections never persist across sessions.
  useEffect(() => {
    setSearchTerm('');
    setFilterOrg('all');
    setFilterStatus('all');
    setSelectedUsers([]);
  }, [routeKey]);

  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCourseAssignModal, setShowCourseAssignModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Real user data from API ──────────────────────────────────────────
  const [usersList, setUsersList] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const mapMemberToUser = useCallback((member: any): User | null => {
    const profile = member?.profile ?? {};
    const profileMetadata = profile?.metadata ?? {};
    const userRow = member?.user ?? {};
    const userId =
      member?.user_id ??
      member?.userId ??
      member?.user_id_uuid ??
      member?.userUuid ??
      member?.id ??
      '';
    if (!userId) return null;

    const firstName = profile.first_name ?? userRow.first_name ?? '';
    const lastName = profile.last_name ?? userRow.last_name ?? '';
    const fullName =
      profile.full_name ??
      profile.fullName ??
      member?.name ??
      `${firstName} ${lastName}`.trim();
    const email = profile.email ?? userRow.email ?? member?.email ?? '';
    if (!email && !fullName) return null;

    const orgProgress = member?.progress ?? {};
    // Derive keys from whichever modules are present in the progress object,
    // falling back to the well-known DEI defaults so the column never goes blank.
    const DEFAULT_KEYS = ['foundations', 'bias', 'empathy', 'conversations', 'planning'];
    const progressKeys = Object.keys(orgProgress).length > 0
      ? Object.keys(orgProgress)
      : DEFAULT_KEYS;
    const progressMap = progressKeys.reduce((acc: Record<string, number>, key) => {
      acc[key] = typeof orgProgress[key] === 'number' ? orgProgress[key] : 0;
      return acc;
    }, {});
    const overallProgress = progressKeys.reduce((sum, k) => sum + (progressMap[k] ?? 0), 0) / progressKeys.length;
    const completedModules = progressKeys.filter((k) => (progressMap[k] ?? 0) >= 100).length;

    const rawStatus = (member?.status || profile?.status || userRow?.status || 'inactive').toString().toLowerCase();
    const normalizedStatus = ['active', 'pending', 'inactive'].includes(rawStatus) ? rawStatus : rawStatus;

    const canonicalOrgId = member?.organization_id ?? member?.org?.id ?? activeOrgId ?? '';
    if (member?.org_id && member?.org_id !== canonicalOrgId) {
      console.warn('Conflicting organization IDs in admin user row', {
        userId,
        canonicalOrgId,
        legacyOrgId: member?.org_id,
      });
    }

    return {
      id: userId,
      name: fullName || email,
      email,
      // Use only the normalized org field from the server response
      organization: canonicalOrgId,
      cohort: profile.cohort ?? profileMetadata.cohort ?? '',
      role:
        profile.title ??
        profile.job_title ??
        profileMetadata.job_title ??
        profileMetadata.title ??
  userRow.role ??
  member?.role ??
        '',
      enrolled: member?.created_at ?? profile.created_at ?? '',
      lastLogin: userRow.last_login_at ?? profile.updated_at ?? '',
      progress: progressMap as User['progress'],
      overallProgress: Math.round(overallProgress),
      status: normalizedStatus,
      completedModules,
      totalModules: progressKeys.length,
      feedbackSubmitted: false,
    };
  }, [activeOrgId]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      let records: any[] = [];

      if (activeOrgId) {
        records = await listUsersByOrg(activeOrgId);
      } else {
        // Platform-admin fallback: fetch from all organizations
        const orgs = await listOrgs();
        const allResults = await Promise.all(
          orgs.map((org) =>
            listUsersByOrg(org.id).catch((err) => {
              console.warn('[AdminUsers] Failed to load users for org', org.id, err);
              return [];
            }),
          ),
        );
        records = allResults.flat();
      }

      const mapped = records.map(mapMemberToUser).filter((u): u is User => u !== null);
      if (mapped.length === 0 && !activeOrgId) {
        // If no active org and no members, clear with empty list but still show that no users were found.
        setUsersList([]);
      } else {
        setUsersList(mapped);
      }
    } catch (err: any) {
      console.error('[AdminUsers] Failed to load users', err);
      setUsersError(err?.message ?? 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, [activeOrgId, mapMemberToUser]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const navigate = useNavigate();

  // Fetch real organizations from the API for filtering and the Add User modal
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    listOrgs()
      .then((orgs) => {
        if (cancelled) return;
        setOrganizations(orgs.map((o) => ({ id: o.id, name: o.name ?? o.id })));
      })
      .catch((err) => {
        console.warn('[AdminUsers] Failed to load organizations for filter', err);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Org course modules (dynamic, falls back to defaults) ─────────────
  const DEFAULT_MODULE_KEYS = ['foundations', 'bias', 'empathy', 'conversations', 'planning'];
  const DEFAULT_MODULE_LABELS: Record<string, string> = {
    foundations: 'Foundations of Inclusive Leadership',
    bias: 'Recognizing and Mitigating Bias',
    empathy: 'Empathy in Action',
    conversations: 'Courageous Conversations at Work',
    planning: 'Personal & Team Action Planning',
  };
  const [dynamicModules, setDynamicModules] = useState<Array<{ key: string; name: string }>>(
    DEFAULT_MODULE_KEYS.map((k) => ({ key: k, name: DEFAULT_MODULE_LABELS[k] ?? k }))
  );

  useEffect(() => {
    if (!activeOrgId) return;
    let active = true;
    (async () => {
      try {
        const res = await apiRequest<{ courses: Array<{ modules?: Array<{ slug?: string; title?: string; id?: string }> }> }>(
          `/api/admin/courses?orgId=${activeOrgId}&status=published&limit=5`
        );
        if (!active) return;
        const allModules: Array<{ key: string, name: string }> = [];
        const seen = new Set<string>();
        (res?.courses ?? []).forEach((course) => {
          (course.modules ?? []).forEach((mod) => {
            const key = mod.slug ?? mod.id ?? '';
            if (key && !seen.has(key)) {
              seen.add(key);
              allModules.push({ key, name: mod.title ?? key });
            }
          });
        });
        if (allModules.length > 0) {
          setDynamicModules(allModules);
        }
      } catch {
        // Non-fatal: keep default module list
      }
    })();
    return () => { active = false; };
  }, [activeOrgId]);

  const modules = dynamicModules;

  const filteredUsers = usersList.filter((user: User) => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.organization.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrg = filterOrg === 'all' || user.organization === filterOrg;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesOrg && matchesStatus;
  });

  const handleSelectUser = (userId: string) => {
    setSelectedUsers((prev: string[]) => 
      prev.includes(userId) 
        ? prev.filter((id: string) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map((user: User) => user.id));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  // Handler functions for button actions
  const handleAddUser = () => {
    setShowAddUserModal(true);
  };

  const handleUserAdded = (_newUser: User) => {
    // Refresh from server to get real data instead of optimistic local append
    void fetchUsers();
    showToast('User account added successfully!', 'success');
  };

  const handleSendReminder = async () => {
    setLoading(true);
    try {
      // Send reminder emails via the server for each selected user
      await Promise.all(
        selectedUsers.map((userId) =>
          apiRequest(`/api/admin/users/${userId}/messages`, {
            method: 'POST',
            body: {
              subject: 'Course Reminder',
              body: 'This is a reminder to continue your course progress.',
              orgId: activeOrgId,
            },
          }).catch(() => null), // don't let one failure block others
        ),
      );
      showToast(`Reminder sent to ${selectedUsers.length} user(s)`, 'success');
      setSelectedUsers([]);
    } catch (error) {
      showToast('Failed to send reminders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCourse = () => {
    setShowCourseAssignModal(true);
  };

  const handleCourseAssignComplete = (assignments?: CourseAssignment[]) => {
    setSelectedUsers([]);
    setShowCourseAssignModal(false);
    const count = assignments?.length ?? 0;
    const message = count > 0
      ? `Assignments sent to ${count} team member${count === 1 ? '' : 's'}.`
      : 'Assignments queued successfully.';
    showToast(`${message} Huddle notifications are on the way.`, 'success');
  };

  const handleImportCSV = () => {
    setShowImportModal(true);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      // Simulate export
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create and download CSV
      const csvContent = `Name,Email,Organization,Status,Progress\n${filteredUsers.map((user: User) => 
        `"${user.name}","${user.email}","${user.organization}","${user.status}","${user.overallProgress}%"`
      ).join('\n')}`;
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast('Users exported successfully!', 'success');
    } catch (error) {
      showToast('Failed to export users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUserToDelete(userId);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete || !activeOrgId) return;
    
    setLoading(true);
    try {
      await apiRequest(`/api/admin/users/${userToDelete}`, {
        method: 'DELETE',
        body: { organizationId: activeOrgId, mode: 'archive' },
        expectedStatus: [200, 204],
      });
      setUsersList((prev: User[]) => prev.filter((user: User) => user.id !== userToDelete));
      showToast('User archived successfully!', 'success');
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (error: any) {
      showToast(error?.message ?? 'Failed to archive user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userId: string) => {
    const user = usersList.find(u => u.id === userId);
    if (user) {
      setUserToEdit(user);
      setShowEditUserModal(true);
    }
  };

  const handleUserUpdated = (updatedUser?: User, transfer?: { fromOrganizationId?: string | null; toOrganizationId?: string | null }) => {
    if (updatedUser) {
      const movedOutOfActiveOrg = activeOrgId && transfer?.fromOrganizationId === activeOrgId && transfer?.toOrganizationId && transfer.toOrganizationId !== activeOrgId;
      const movedOutOfFilteredOrg = !activeOrgId && filterOrg !== 'all' && transfer?.fromOrganizationId === filterOrg && transfer?.toOrganizationId && transfer.toOrganizationId !== filterOrg;

      if (movedOutOfActiveOrg) {
        setUsersList((prev: User[]) => prev.filter((user: User) => user.id !== updatedUser.id));
        showToast(`User moved to organization ${transfer.toOrganizationId} and removed from this organization list.`, 'success');
        void fetchUsers();
        return;
      }

      if (movedOutOfFilteredOrg) {
        showToast(`User moved to organization ${transfer.toOrganizationId} and removed from this filtered list.`, 'success');
        void fetchUsers();
        return;
      }
    }

    // General refresh for global and same-org updates
    void fetchUsers();
    showToast('User updated successfully!', 'success');
    setShowEditUserModal(false);
    setUserToEdit(null);
  };

  const statusOptions = useMemo(() => {
    const unique = ['active', 'pending', 'inactive'];
    usersList.forEach((u) => {
      const status = (u.status || '').toString().toLowerCase();
      if (status && !unique.includes(status)) {
        unique.push(status);
      }
    });
    return unique;
  }, [usersList]);

  return (
    <PageWrapper>
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Users', to: '/admin/users' }]} />
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="h1">User Management</h1>
          <p className="muted-text">Monitor learner progress, assign courses, and manage user accounts</p>
        </div>
        <button
          onClick={() => void fetchUsers()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm"
          title="Refresh users"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {usersError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{usersError}</p>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="card mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 max-w-[520px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 muted-text" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="input pl-10"
                aria-label="Search users"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 muted-text" />
              <select
                value={filterOrg}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterOrg(e.target.value)}
                className="input min-w-[160px]"
                aria-label="Filter by organization"
              >
                <option value="all">All Organizations</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
                className="input min-w-[140px]"
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status[0]?.toUpperCase() + status.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedUsers.length > 0 && (
              <div className="flex items-center gap-2">
                <LoadingButton
                  onClick={handleSendReminder}
                  loading={loading}
                  variant="primary"
                >
                  <Mail className="icon-16" />
                  Send Reminder ({selectedUsers.length})
                </LoadingButton>
                <LoadingButton
                  onClick={handleAssignCourse}
                  loading={loading}
                  variant="success"
                >
                  Assign Course
                </LoadingButton>
              </div>
            )}
            <LoadingButton
              onClick={handleAddUser}
              variant="primary"
            >
              <Plus className="icon-16" />
              Add User
            </LoadingButton>
            <LoadingButton
              onClick={handleImportCSV}
              variant="secondary"
            >
              <Upload className="icon-16" />
              Import CSV
            </LoadingButton>
            <LoadingButton
              onClick={handleExport}
              loading={loading}
              variant="secondary"
            >
              <Download className="icon-16" />
              Export
            </LoadingButton>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-card">
        {usersLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-collapse">
            <thead className="table-head">
              <tr>
                <th className="table-cell">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={handleSelectAll}
                    aria-label="Select all users"
                    className="checkbox-sm"
                  />
                </th>
                <th className="table-cell table-head-cell" scope="col">User</th>
                <th className="table-cell table-head-cell" scope="col">Organization</th>
                <th className="table-cell table-head-cell text-center" scope="col">Progress</th>
                <th className="table-cell table-head-cell text-center" scope="col">Modules</th>
                <th className="table-cell table-head-cell text-center" scope="col">Status</th>
                <th className="table-cell table-head-cell text-center" scope="col">Last Login</th>
                <th className="table-cell table-head-cell text-center" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user: User) => (
                <tr key={user.id} className="table-row-border">
                  <td className="table-cell">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                      aria-label={`Select user ${user.name}`}
                      className="checkbox-sm"
                    />
                  </td>
                  <td className="table-cell">
                    <div>
                      <div className="progress-number">{user.name}</div>
                      <div className="muted-small text-13">{user.email}</div>
                      <div className="muted-small text-12">{user.role}</div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div>
                      <div className="progress-number">
                        {organizations.find((o) => o.id === user.organization)?.name ?? user.organization}
                      </div>
                      <div className="muted-small text-13">{user.cohort}</div>
                    </div>
                  </td>
                  <td className="table-cell text-center">
                    <div className="flex flex-col items-center">
                      <div className="progress-number">{user.overallProgress}%</div>
                      <div className="progress-track mt-1">
                        <div
                          className="progress-fill"
                          style={{ width: `${user.overallProgress}%` }}
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={user.overallProgress}
                          aria-label={`${user.name} overall progress`}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-center">
                      <div className="text-13">
                      <span className="font-bold">{user.completedModules}</span>
                      <span className="muted-text">/ {user.totalModules}</span>
                    </div>
                    <div className="flex justify-center gap-2 mt-1">
                      {modules.map((module) => {
                        const val = user.progress[module.key as keyof typeof user.progress] as number;
                        const color = val === 100 ? 'var(--accent-success)' : val > 0 ? 'var(--highlight)' : 'var(--surface-muted)';
                        return (
                          <div key={module.key} title={`${module.name}: ${val}%`} className="module-dot" style={{ background: color }} />
                        );
                      })}
                    </div>
                  </td>
                  <td className="table-cell text-center">
                    <div className="flex items-center justify-center gap-2">
                      {getStatusIcon(user.status)}
                      <span className={`status-badge ${user.status === 'active' ? 'status-active' : user.status === 'inactive' ? 'status-inactive' : user.status === 'pending' ? 'status-pending' : 'status-error'}`}>
                        {user.status}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell text-center muted-text text-13">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '—'}
                  </td>
                  <td className="table-cell text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        to={`/admin/users/user-${user.id}`}
                        title="View Profile"
                        aria-label={`View profile for ${user.name}`}
                        className="icon-action secondary"
                        tabIndex={0}
                        role="button"
                        data-tooltip-id={`tooltip-view-${user.id}`}
                      >
                        <Eye className="icon-16" />
                      </Link>
                      <button
                        onClick={() => handleEditUser(user.id)}
                        title="Edit User"
                        aria-label={`Edit ${user.name}`}
                        className="icon-action muted"
                        tabIndex={0}
                        role="button"
                        data-tooltip-id={`tooltip-edit-${user.id}`}
                      >
                        <Edit className="icon-16" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        title="Delete User"
                        aria-label={`Delete ${user.name}`}
                        className="icon-action primary"
                        tabIndex={0}
                        role="button"
                        data-tooltip-id={`tooltip-delete-${user.id}`}
                      >
                        <Trash2 className="icon-16" />
                      </button>
                      <ActionsMenu
                        items={[
                          { key: 'view', label: 'View', onClick: () => navigate(`/admin/users/${user.id}`) },
                          { key: 'edit', label: 'Edit', onClick: () => handleEditUser(user.id) },
                          { key: 'delete', label: 'Delete', onClick: () => handleDeleteUser(user.id), destructive: true },
                        ]}
                      />
                      {/* Tooltips for icon-only actions */}
                      <span id={`tooltip-view-${user.id}`} className="sr-only">View profile</span>
                      <span id={`tooltip-edit-${user.id}`} className="sr-only">Edit user</span>
                      <span id={`tooltip-delete-${user.id}`} className="sr-only">Delete user</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {!usersLoading && filteredUsers.length === 0 && (
        <div className="mt-8">
          <EmptyState
            title={usersList.length === 0 ? 'No users yet' : 'No users found'}
            description={usersList.length === 0
              ? 'Invite your first user by clicking "Add User" above.'
              : 'Try adjusting your search or filter criteria.'}
            action={(
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setFilterOrg('all'); setFilterStatus('all'); setSelectedUsers([]); }}
                className="btn-outline"
              >
                Reset filters
              </button>
            )}
            illustrationSrc={undefined}
          />
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-blue-600">{filteredUsers.length}</div>
          <div className="text-sm text-gray-600">Total Users</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-green-600">
            {filteredUsers.filter((u: User) => u.status === 'active').length}
          </div>
          <div className="text-sm text-gray-600">Active Users</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {Math.round(filteredUsers.reduce((acc: number, user: User) => acc + user.overallProgress, 0) / filteredUsers.length) || 0}%
          </div>
          <div className="text-sm text-gray-600">Avg. Progress</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {filteredUsers.filter((u: User) => u.feedbackSubmitted).length}
          </div>
          <div className="text-sm text-gray-600">Feedback Submitted</div>
        </div>
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onUserAdded={handleUserAdded}
        organizations={organizations}
        defaultOrgId={filterOrg !== 'all' ? filterOrg : activeOrgId}
      />

      <UserCsvImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        organizations={organizations}
        onImportComplete={() => void fetchUsers()}
      />

      <CourseAssignmentModal
        isOpen={showCourseAssignModal}
        onClose={() => setShowCourseAssignModal(false)}
        selectedUsers={selectedUsers}
        onAssignComplete={handleCourseAssignComplete}
      />

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDeleteUser}
        title="Archive User"
        message="Are you sure you want to archive this user for the current organization? This revokes their membership and removes them from active assignment and messaging workflows."
        confirmText="Archive User"
        type="danger"
        loading={loading}
      />

      {/* Edit User Modal */}
      {showEditUserModal && userToEdit && (
        <AddUserModal
          isOpen={showEditUserModal}
          onClose={() => {
            setShowEditUserModal(false);
            setUserToEdit(null);
          }}
          onUserAdded={handleUserUpdated}
          editUser={userToEdit}
          organizations={organizations}
          defaultOrgId={filterOrg !== 'all' ? filterOrg : activeOrgId}
        />
      )}
    </PageWrapper>
  );
};

export default AdminUsers;
