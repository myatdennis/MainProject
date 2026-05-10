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
import Button from '../../components/ui/Button';
import ActionsMenu from '../../components/ui/ActionsMenu';
import { listOrgs, onOrgListInvalidated } from '../../dal/orgs';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { getAuthState } from '../../store/authStore';
import { GLOBAL_ORG_ID } from '../../constants/org';
import Loading from '../../components/ui/Loading';
import apiRequest from '../../utils/apiClient';
import { useRouteChangeReset } from '../../hooks/useRouteChangeReset';
import { useNavTrace } from '../../hooks/useNavTrace';
import { nanoid } from 'nanoid';

const USERS_PAGE_SIZE = 25;

export const getUserTransferToastMessage = (
  currentOrgContext: string | null,
  transfer: { fromOrganizationId?: string | null; toOrganizationId?: string | null } | undefined,
  organizations: Array<{ id: string; name: string }>,
): string | null => {
  if (!currentOrgContext || !transfer || !transfer.fromOrganizationId || !transfer.toOrganizationId) {
    return null;
  }

  const movedOut = transfer.fromOrganizationId === currentOrgContext && transfer.toOrganizationId !== currentOrgContext;
  if (!movedOut) return null;

  const targetOrgName = organizations.find((org) => org.id === transfer.toOrganizationId)?.name || transfer.toOrganizationId;
  return `User moved to ${targetOrgName} and removed from this list.`;
};

const AdminUsers = () => {
  useNavTrace('AdminUsers');
  const { activeOrgId, user } = useSecureAuth();
  const authSnap = getAuthState();
  const isPlatformAdmin = String(
    user?.appMetadata?.platform_role ??
    user?.appMetadata?.platformRole ??
    user?.platformRole ??
    authSnap?.user?.appMetadata?.platform_role ??
    authSnap?.user?.appMetadata?.platformRole ??
    authSnap?.user?.platformRole ??
    '',
  ).toLowerCase() === 'platform_admin';
  const activeOrgScopeId = activeOrgId === GLOBAL_ORG_ID ? null : activeOrgId;
  const { routeKey } = useRouteChangeReset();

  // Reset transient UI state (filters, selections) whenever the user navigates
  // away from and back to this page so stale selections never persist across sessions.
  useEffect(() => {
    setSearchTerm('');
    setFilterOrg('all');
    setFilterStatus('all');
    setCurrentPage(1);
    setSelectedUsers([]);
  }, [routeKey]);

  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCourseAssignModal, setShowCourseAssignModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [pendingUserActionIds, setPendingUserActionIds] = useState<string[]>([]);
  const [pendingUserActionMode, setPendingUserActionMode] = useState<'archive' | 'delete'>('archive');
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
      member?.user?.id ??
      member?.user_id_uuid ??
      member?.id ??
      member?.membershipId ??
      '';
    if (!userId || !String(userId).trim()) return null;

    const firstName =
      profile.first_name ??
      userRow.first_name ??
      member?.first_name ??
      '';
    const lastName =
      profile.last_name ??
      userRow.last_name ??
      member?.last_name ??
      '';
    const fullName =
      profile.full_name ??
      profile.fullName ??
      member?.name ??
      `${firstName} ${lastName}`.trim();

    const email =
      profile.email ??
      userRow.email ??
      member?.email ??
      member?.user?.email ??
      '';
    if (!email && !fullName) return null;

    const orgFromMember =
      member?.organization_id ??
      member?.org_id ??
      member?.orgId ??
      member?.organization ??
      member?.org?.id ??
      member?.org?.organization_id ??
      '';

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

    const rawStatus = (member?.status || profile?.status || 'inactive').toString().toLowerCase();
    const normalizedStatus = ['active', 'pending', 'inactive'].includes(rawStatus) ? rawStatus : rawStatus;

    const canonicalOrgId = orgFromMember || activeOrgScopeId || '';
    const profileOrgId = profile.organization_id ?? profile.org_id ?? null;
    if (profileOrgId && profileOrgId !== canonicalOrgId) {
      console.warn('[AdminUsers] organization_id mismatch', {
        userId: String(userId),
        canonicalOrgId,
        profileOrgId,
      });
    }

    return {
      id: String(userId),
      name: fullName || email,
      email,
      organization: canonicalOrgId,
      organization_id: canonicalOrgId,
      organizationName: profile.organization_name ?? profile.organizationName ?? (member?.organization || null),
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
  lastLogin: userRow?.updated_at ?? profile.updated_at ?? '',
      progress: progressMap as User['progress'],
      overallProgress: Math.round(overallProgress),
      status: normalizedStatus,
      completedModules,
      totalModules: progressKeys.length,
      feedbackSubmitted: false,
    };
  }, [activeOrgScopeId]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    const clientRequestId = `admin-users-${nanoid(8)}`;
    try {
      const normalizedFilterOrg = filterOrg !== 'all' ? filterOrg : null;
      const queryOrgId = normalizedFilterOrg ?? (!isPlatformAdmin ? activeOrgScopeId : null);

      if (!isPlatformAdmin && !queryOrgId) {
        throw new Error('Organization context is required for non-platform administrators.');
      }

      const queryString = queryOrgId ? `?orgId=${encodeURIComponent(queryOrgId)}` : '';
      const apiPath = `/api/admin/users${queryString}`;

      console.info('[AdminUsers] request_dispatch', {
        clientRequestId,
        apiPath,
        activeOrgId,
        requestedOrgId: queryOrgId,
        isPlatformAdmin,
        filterOrg,
      });

      const response = await apiRequest<any[] | { data?: any[] }>(apiPath, { noTransform: true });
      const envelopeKeys = response && typeof response === 'object' ? Object.keys(response as Record<string, unknown>) : [];
      const records = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];

      const mapped = records.map(mapMemberToUser).filter((u): u is User => u !== null);

      // Strict invariants
      const duplicates = mapped.reduce<Record<string, number>>((acc, user) => {
        acc[user.id] = (acc[user.id] || 0) + 1;
        return acc;
      }, {});
      Object.entries(duplicates).forEach(([id, count]) => {
        if (count > 1) {
          console.error('[AdminUsers] duplicate_user_id', { id, count });
        }
      });

      console.info('[AdminUsers] response_received', {
        clientRequestId,
        requestedOrgId: queryOrgId,
        rowCount: records.length,
        mappedCount: mapped.length,
        envelopeKeys,
      });
      setUsersList(mapped);
    } catch (err: any) {
      console.error('[AdminUsers] Failed to load users', err);
      setUsersError(err?.message ?? 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, [activeOrgId, activeOrgScopeId, filterOrg, isPlatformAdmin, mapMemberToUser]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const uiState = usersLoading ? 'loading' : usersError ? 'error' : usersList.length === 0 ? 'empty' : 'success';
    console.info('[AdminUsers] final_ui_state', {
      route: '/admin/users',
      requestedOrgId: filterOrg !== 'all' ? filterOrg : activeOrgId ?? null,
      uiState,
      rowCount: usersList.length,
    });
  }, [activeOrgId, filterOrg, usersError, usersList.length, usersLoading]);

  const navigate = useNavigate();

  // Fetch real organizations from the API for filtering and the Add User modal
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    if (!activeOrgId && !isPlatformAdmin) return;
    listOrgs(undefined, { preferredOrgId: activeOrgScopeId })
      .then((orgs) => {
        if (cancelled) return;
        setOrganizations(orgs.map((o) => ({ id: o.id, name: o.name ?? o.id })));
      })
      .catch((err) => {
        console.warn('[AdminUsers] Failed to load organizations for filter', err);
      });
    return () => { cancelled = true; };
  }, [activeOrgId, activeOrgScopeId, isPlatformAdmin]);

  // Refresh organizations list when other parts of the app invalidate org list
  useEffect(() => {
    const unsub = onOrgListInvalidated?.(() => {
      let cancelled = false;
      if (!activeOrgId && !isPlatformAdmin) return;
      listOrgs({}, { forceRefresh: true, preferredOrgId: activeOrgScopeId })
        .then((orgs) => {
          if (cancelled) return;
          setOrganizations(orgs.map((o) => ({ id: o.id, name: o.name ?? o.id })));
        })
        .catch((err) => {
          console.warn('[AdminUsers] Failed to refresh organizations after invalidation', err);
        });
      return () => { cancelled = true; };
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [activeOrgId, activeOrgScopeId, isPlatformAdmin]);

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
    // Only fetch org-scoped modules when we have a concrete activeOrgId
    // (and it's not the ALL_ORGS sentinel). RequireAuth and auth context
    // should ensure this is available during initial page load; this is an
    // extra defensive guard to prevent accidental requests.
    if (!activeOrgId || activeOrgId === 'ALL_ORGS') return;
    let active = true;
    (async () => {
      try {
        const path = `/api/admin/courses${activeOrgId ? `?orgId=${encodeURIComponent(activeOrgId)}` : ''}&status=published&limit=5`;
        const res = await apiRequest<{ courses: Array<{ modules?: Array<{ slug?: string; title?: string; id?: string }> }> }>(path);
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

  const filteredUsers = useMemo(() => usersList.filter((user: User) => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.organization.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrg = filterOrg === 'all' || user.organization === filterOrg;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesOrg && matchesStatus;
  }), [filterOrg, filterStatus, searchTerm, usersList]);

  const filteredUserIds = useMemo(() => new Set(filteredUsers.map((entry) => entry.id)), [filteredUsers]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const boundedCurrentPage = Math.min(currentPage, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (boundedCurrentPage - 1) * USERS_PAGE_SIZE;
    return filteredUsers.slice(start, start + USERS_PAGE_SIZE);
  }, [boundedCurrentPage, filteredUsers]);
  const paginationStart = filteredUsers.length === 0 ? 0 : (boundedCurrentPage - 1) * USERS_PAGE_SIZE + 1;
  const paginationEnd = filteredUsers.length === 0 ? 0 : paginationStart + paginatedUsers.length - 1;
  const pageUserIds = useMemo(() => new Set(paginatedUsers.map((entry) => entry.id)), [paginatedUsers]);
  const visibleSelectedUsers = useMemo(
    () => selectedUsers.filter((id) => pageUserIds.has(id)),
    [pageUserIds, selectedUsers],
  );

  useEffect(() => {
    setSelectedUsers((prev) => prev.filter((id) => filteredUserIds.has(id)));
  }, [filteredUserIds]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterOrg, filterStatus, searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSelectUser = (userId: string) => {
    setSelectedUsers((prev: string[]) => 
      prev.includes(userId) 
        ? prev.filter((id: string) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (visibleSelectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0) {
      setSelectedUsers((prev) => prev.filter((id) => !pageUserIds.has(id)));
    } else {
      setSelectedUsers((prev) => Array.from(new Set([...prev, ...paginatedUsers.map((user: User) => user.id)])));
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
    // Full source of truth from server - force refetch after create
    void fetchUsers();
    showToast('User account added successfully!', 'success');
  };

  const handleSendReminder = async () => {
    setLoading(true);
    try {
      // Send reminder emails via the server for each selected user
      await Promise.all(
        selectedUsers.map((userId) =>
          (async () => {
            if (!activeOrgScopeId && !isPlatformAdmin) {
              console.warn('Skipping API call — no org selected (handleSendReminder)');
              // org call skipped during hardening: no-op
              return null;
            }
            return apiRequest(`/api/admin/users/${userId}/messages`, {
              method: 'POST',
              body: {
                subject: 'Course Reminder',
                body: 'This is a reminder to continue your course progress.',
                orgId: activeOrgScopeId,
              },
            }).catch(() => null);
          })(),
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
    setPendingUserActionMode('archive');
    setPendingUserActionIds([userId]);
    setShowDeleteModal(true);
  };

  const handleArchiveSelectedUsers = () => {
    if (selectedUsers.length === 0) return;
    setPendingUserActionMode('archive');
    setPendingUserActionIds([...selectedUsers]);
    setShowDeleteModal(true);
  };

  const handleDeleteSelectedUsers = () => {
    if (selectedUsers.length === 0) return;
    setPendingUserActionMode('delete');
    setPendingUserActionIds([...selectedUsers]);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (pendingUserActionIds.length === 0) return;

    const resolveArchiveOrganizationId = (userId: string): string | null => {
      const target = usersList.find((entry) => entry.id === userId);
      return target?.organization || activeOrgScopeId || (filterOrg !== 'all' ? filterOrg : null);
    };

    if (pendingUserActionMode === 'archive' && !isPlatformAdmin && !activeOrgScopeId && filterOrg === 'all') {
      showToast('Select an organization before archiving users.', 'error');
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.allSettled(
        pendingUserActionIds.map(async (userId) => {
          const body: Record<string, unknown> = { mode: pendingUserActionMode };
          if (pendingUserActionMode === 'archive') {
            const organizationId = resolveArchiveOrganizationId(userId);
            if (!organizationId) {
              throw new Error('organizationId is required to archive selected users.');
            }
            body.organizationId = organizationId;
          }

          if (body.organizationId == null && !isPlatformAdmin) {
            console.warn('Skipping API call — no org selected (confirmDeleteUser)');
            // org call skipped during hardening: no-op
            throw new Error('Organization context is required');
          }
          await apiRequest(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            body,
            expectedStatus: [200, 204],
          });
        }),
      );

      const successCount = results.filter((entry) => entry.status === 'fulfilled').length;
      const failureCount = results.length - successCount;
      const actionLabel = pendingUserActionMode === 'delete' ? 'deleted' : 'archived';

      if (successCount > 0) {
        showToast(
          `${successCount} user${successCount === 1 ? '' : 's'} ${actionLabel} successfully${failureCount > 0 ? ` (${failureCount} failed)` : ''}.`,
          failureCount > 0 ? 'warning' : 'success',
        );
      } else {
        showToast(`Failed to ${pendingUserActionMode} selected users.`, 'error');
      }

      setShowDeleteModal(false);
      setPendingUserActionIds([]);
      setSelectedUsers((prev) => prev.filter((id) => !pendingUserActionIds.includes(id)));
      // full refetch to avoid stale partial state
      void fetchUsers();
    } catch (error: any) {
      showToast(error?.message ?? `Failed to ${pendingUserActionMode} user`, 'error');
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
      const currentOrgContext = activeOrgScopeId || (filterOrg !== 'all' ? filterOrg : null);
      const transferMessage = getUserTransferToastMessage(currentOrgContext, transfer, organizations);
      if (transferMessage) {
        showToast(transferMessage, 'success');
      } else {
        showToast('User updated successfully!', 'success');
      }
    }

    setShowEditUserModal(false);
    setUserToEdit(null);

    // Always re-fetch server state to avoid stale locality from prior list contents.
    void fetchUsers();
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
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="h1">User Management</h1>
          <p className="muted-text">Monitor learner progress, assign courses, and manage user accounts</p>
        </div>
        <Button
          onClick={() => void fetchUsers()}
          variant="ghost"
          size="sm"
          leadingIcon={<RefreshCw className="h-4 w-4" />}
          title="Refresh users"
        >
          Refresh
        </Button>
      </div>

      {usersError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm">{usersError}</p>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void fetchUsers()}>
                Retry loading users
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="card mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-[520px]">
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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

          <div className="flex flex-wrap items-center gap-3">
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  {visibleSelectedUsers.length} selected
                </span>
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
                <LoadingButton
                  onClick={handleArchiveSelectedUsers}
                  loading={loading}
                  variant="secondary"
                >
                  <Clock className="icon-16" />
                  Archive Selected ({selectedUsers.length})
                </LoadingButton>
                {isPlatformAdmin && (
                  <LoadingButton
                    onClick={handleDeleteSelectedUsers}
                    loading={loading}
                    variant="danger"
                  >
                    <Trash2 className="icon-16" />
                    Delete Selected ({selectedUsers.length})
                  </LoadingButton>
                )}
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
              disabled={filteredUsers.length === 0}
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
            <Loading size="lg" />
          </div>
        ) : usersError ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            Resolve the loading error above, then retry the user list.
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full table-collapse">
              <thead className="table-head">
                <tr>
                  <th className="table-cell">
                    <input
                      type="checkbox"
                      checked={visibleSelectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
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
                {paginatedUsers.map((user: User) => (
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
                      <div className="progress-number break-words">{user.name}</div>
                      <div className="muted-small text-13 break-all">{user.email}</div>
                      <div className="muted-small text-12 break-words">{user.role || 'Member'}</div>
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
                          style={{ width: `${Math.max(0, Math.min(100, user.overallProgress))}%` }}
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
                        to={`/admin/users/${user.id}`}
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
                        title="Archive User"
                        aria-label={`Archive ${user.name}`}
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
                          { key: 'archive', label: 'Archive', onClick: () => handleDeleteUser(user.id), destructive: true },
                          ...(isPlatformAdmin
                            ? [{ key: 'delete', label: 'Delete permanently', onClick: () => {
                                setPendingUserActionMode('delete');
                                setPendingUserActionIds([user.id]);
                                setShowDeleteModal(true);
                              }, destructive: true }]
                            : []),
                        ]}
                      />
                      {/* Tooltips for icon-only actions */}
                      <span id={`tooltip-view-${user.id}`} className="sr-only">View profile</span>
                      <span id={`tooltip-edit-${user.id}`} className="sr-only">Edit user</span>
                      <span id={`tooltip-delete-${user.id}`} className="sr-only">Archive user</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-12">
            <EmptyState
              title={usersList.length === 0 ? 'No users yet' : 'No users found'}
              description={usersList.length === 0
                ? 'Invite the first learner or administrator for this organization.'
                : 'Try adjusting your search, organization, or status filters.'}
              action={usersList.length === 0 ? (
                <Button onClick={handleAddUser} type="button" variant="primary" size="sm">
                  Add User
                </Button>
              ) : (
                <Button
                  onClick={() => { setSearchTerm(''); setFilterOrg('all'); setFilterStatus('all'); setSelectedUsers([]); }}
                  type="button"
                  variant="outline"
                  size="sm"
                >
                  Reset filters
                </Button>
              )}
              illustrationSrc={undefined}
            />
          </div>
        )}
      </div>

      {!usersLoading && !usersError && filteredUsers.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {paginationStart}-{paginationEnd} of {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={boundedCurrentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Previous
            </Button>
            <span className="min-w-16 text-center text-xs font-semibold text-gray-500">
              {boundedCurrentPage} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={boundedCurrentPage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              Next
            </Button>
          </div>
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
        defaultOrgId={filterOrg !== 'all' ? filterOrg : activeOrgScopeId}
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
          setPendingUserActionIds([]);
        }}
        onConfirm={confirmDeleteUser}
        title={pendingUserActionMode === 'delete' ? 'Delete User' : 'Archive User'}
        message={
          pendingUserActionMode === 'delete'
            ? `Are you sure you want to permanently delete ${pendingUserActionIds.length > 1 ? `${pendingUserActionIds.length} users` : 'this user'}? This cannot be undone.`
            : `Are you sure you want to archive ${pendingUserActionIds.length > 1 ? `${pendingUserActionIds.length} users` : 'this user'} for the current organization? This revokes memberships and removes them from active assignment and messaging workflows.`
        }
        confirmText={pendingUserActionMode === 'delete' ? 'Delete User' : 'Archive User'}
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
          defaultOrgId={filterOrg !== 'all' ? filterOrg : activeOrgScopeId}
        />
      )}
    </PageWrapper>
  );
};

export default AdminUsers;
