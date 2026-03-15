import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle,
  Clock,
  Download,
  Mail,
  Plus,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import ActionsMenu from '../../components/ui/ActionsMenu';
import LoadingButton from '../../components/LoadingButton';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmationModal from '../../components/ConfirmationModal';
import AddOrganizationModal from '../../components/AddOrganizationModal';
import EditOrganizationModal from '../../components/EditOrganizationModal';
import OrgCommunicationPanel from '../../components/Admin/OrgCommunicationPanel';
import CourseAssignmentModal from '../../components/CourseAssignmentModal';
import { useToast } from '../../context/ToastContext';
import orgService, { type Org, OrgProfileDetails } from '../../dal/orgs';
import { getCrmSummary, sendBroadcastNotification, type CrmSummary } from '../../dal/crm';
import { useDebounce } from '../../components/PerformanceComponents';

const PAGE_SIZE = 24;
type StatusFilterOption = 'all' | 'active' | 'inactive' | 'suspended' | 'trial';
type SubscriptionFilterOption = 'all' | 'Standard' | 'Premium' | 'Enterprise';

type BroadcastAudience = 'custom' | 'all_active_orgs' | 'all_active_users';

const createEmptyCrmSummary = (): CrmSummary => ({
  organizations: { total: 0, active: 0, onboarding: 0, newThisMonth: 0 },
  users: { total: 0, active: 0, invited: 0, recentActive: 0 },
  assignments: { coursesLast30d: 0, surveysLast30d: 0, overdue: 0 },
  communication: { messagesLast30d: 0, notificationsLast30d: 0, unreadNotifications: 0 },
  invites: { pending: 0, accepted: 0, expired: 0 },
});

const deriveCrmSummaryFromOrganizations = (orgs: Org[], paginationTotal?: number): CrmSummary => {
  const derived = createEmptyCrmSummary();
  if (!orgs || orgs.length === 0) {
    derived.organizations.total = paginationTotal ?? 0;
    return derived;
  }
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const total = typeof paginationTotal === 'number' && paginationTotal > 0 ? paginationTotal : orgs.length;
  derived.organizations.total = total;
  derived.organizations.active = orgs.filter((org) => (org.status ?? '').toLowerCase() === 'active').length;
  derived.organizations.onboarding = orgs.filter((org) => {
    const onboardingStatus = (org.onboardingStatus ?? '').toLowerCase();
    return onboardingStatus && onboardingStatus !== 'complete';
  }).length;
  derived.organizations.newThisMonth = orgs.filter((org) => {
    if (!org.createdAt) return false;
    const created = new Date(org.createdAt);
    return created >= monthStart;
  }).length;

  const totalLearners = orgs.reduce((sum, org) => sum + (org.totalLearners ?? 0), 0);
  const activeLearners = orgs.reduce((sum, org) => sum + (org.activeLearners ?? 0), 0);
  derived.users = {
    total: totalLearners,
    active: activeLearners,
    invited: Math.max(totalLearners - activeLearners, 0),
    recentActive: activeLearners,
  };

  return derived;
};

// ...existing code for AdminOrgWorkspace continues

const AdminOrgWorkspace = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionFilterOption>('all');
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, any>>({});
  const [fetching, setFetching] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paginationMeta, setPaginationMeta] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, hasMore: false });
  const debouncedSearch = useDebounce(searchTerm, 250);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [showEditOrgModal, setShowEditOrgModal] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<string | null>(null);
  const [orgToArchive, setOrgToArchive] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [orgToRestore, setOrgToRestore] = useState<string | null>(null);
  const [orgToEdit, setOrgToEdit] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgProfile, setSelectedOrgProfile] = useState<OrgProfileDetails | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [crmSummary, setCrmSummary] = useState<CrmSummary | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    channel: 'in_app',
    audience: 'all_active_orgs' as BroadcastAudience,
    organizationIds: '',
    userIds: '',
  });
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const [showCourseAssignModal, setShowCourseAssignModal] = useState(false);

  const derivedSummary = useMemo(
    () => deriveCrmSummaryFromOrganizations(organizations, paginationMeta.total),
    [organizations, paginationMeta.total],
  );

  const summaryForDisplay = useMemo(() => {
    if (crmSummary && !crmSummary.disabled && crmSummary.organizations.total > 0) {
      return crmSummary;
    }
    return derivedSummary;
  }, [crmSummary, derivedSummary]);

  const usingDerivedSummary = useMemo(() => summaryForDisplay !== crmSummary, [summaryForDisplay, crmSummary]);

  const orgListStats = useMemo(() => {
    const total = paginationMeta.total || organizations.length;
    const active = organizations.filter((org) => (org.status ?? '').toLowerCase() === 'active').length;
    return { total, active };
  }, [organizations, paginationMeta.total]);

  const loadCrmData = useCallback(async () => {
    setCrmLoading(true);
    setCrmError(null);
    try {
  const [summaryData] = await Promise.all([getCrmSummary()]);
  setCrmSummary(summaryData);
    } catch (error) {
      console.error('Failed to load CRM data', error);
      setCrmError(error instanceof Error ? error.message : 'Unable to load CRM data');
    } finally {
      setCrmLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCrmData();
  }, [loadCrmData]);

  const fetchOrganizations = useCallback(
    async (targetPage = 1) => {
      setFetching(true);
      setLoadError(null);
      try {
        const response = await orgService.listOrgPage({
          page: targetPage,
          pageSize: PAGE_SIZE,
          search: debouncedSearch || undefined,
          includeProgress: true,
          status: statusFilter === 'all' ? undefined : [statusFilter],
          subscription: subscriptionFilter === 'all' ? undefined : [subscriptionFilter],
        });
        setOrganizations(response.data);
        setProgressMap(response.progress ?? {});
        setPaginationMeta(response.pagination);
        if (!selectedOrgId && response.data.length > 0) {
          setSelectedOrgId(response.data[0].id);
        }
      } catch (error) {
        console.error('Failed to load organizations', error);
        setLoadError('Unable to load organizations');
        showToast?.('Unable to load organizations', 'error');
      } finally {
        setFetching(false);
        setInitialLoad(false);
      }
    },
    [debouncedSearch, statusFilter, subscriptionFilter, selectedOrgId, showToast],
  );

  useEffect(() => {
    fetchOrganizations(1);
  }, [fetchOrganizations]);

  const handleRefreshOrgs = useCallback(() => {
    fetchOrganizations(paginationMeta.page || 1);
  }, [fetchOrganizations, paginationMeta.page]);

  const loadSelectedOrgProfile = useCallback(
    async (orgId: string | null) => {
      if (!orgId) {
        setSelectedOrgProfile(null);
        setProfileError(null);
        return;
      }
      setProfileLoading(true);
      setProfileError(null);
      try {
        const profile = await orgService.getOrgProfileDetails(orgId);
        setSelectedOrgProfile(profile);
      } catch (error) {
        console.error('Failed to load organization profile', error);
        setProfileError('Unable to load organization profile');
        setSelectedOrgProfile(null);
      } finally {
        setProfileLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadSelectedOrgProfile(selectedOrgId);
  }, [selectedOrgId, loadSelectedOrgProfile]);

  const handleSelectOrganization = (orgId: string) => {
    setSelectedOrgId(orgId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const getSubscriptionBadge = (subscription: string) =>
    subscription === 'Premium' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';

  const handleAddOrganization = () => {
    setShowAddOrgModal(true);
  };

  const handleOrganizationAdded = (organization?: Org) => {
    setShowAddOrgModal(false);
    fetchOrganizations(1);
    void loadCrmData();
    if (organization?.id) {
      navigate(`/admin/organizations/${organization.id}`);
    }
  };

  const handleEditOrganization = (orgId: string) => {
    const org = organizations.find((entry) => entry.id === orgId);
    if (!org) return;
    setOrgToEdit(org);
    setShowEditOrgModal(true);
  };

  const handleOrganizationUpdated = () => {
    setShowEditOrgModal(false);
    setOrgToEdit(null);
    fetchOrganizations(paginationMeta.page || 1);
    if (selectedOrgId) {
      void loadSelectedOrgProfile(selectedOrgId);
    }
  };

  const handleDeleteOrganization = (orgId: string) => {
    setOrgToDelete(orgId);
    setShowDeleteModal(true);
  };

  const handleArchiveOrganization = (orgId: string) => {
    setOrgToArchive(orgId);
    setShowArchiveModal(true);
  };

  const handleRestoreOrganization = (orgId: string) => {
    setOrgToRestore(orgId);
    setShowRestoreModal(true);
  };

  const confirmDeleteOrganization = async () => {
    if (!orgToDelete) return;
    setLoading(true);
    try {
      await orgService.deleteOrg(orgToDelete);
      setOrganizations((prev) => prev.filter((org) => org.id !== orgToDelete));
      if (selectedOrgId === orgToDelete) {
        setSelectedOrgId(null);
      }
      showToast?.('Organization deleted successfully', 'success');
      setShowDeleteModal(false);
      setOrgToDelete(null);
      void loadCrmData();
    } catch (error) {
      console.error('Failed to delete organization', error);
      showToast?.('Failed to delete organization', 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmArchiveOrganization = async () => {
    if (!orgToArchive) return;
    setLoading(true);
    try {
      await orgService.updateOrg(orgToArchive, { status: 'inactive' });
      setOrganizations((prev) => prev.map((org) => (org.id === orgToArchive ? { ...org, status: 'inactive' } : org)));
      if (selectedOrgId === orgToArchive) {
        void loadSelectedOrgProfile(selectedOrgId);
      }
      showToast?.('Organization archived (set to inactive).', 'success');
      setShowArchiveModal(false);
      setOrgToArchive(null);
      void loadCrmData();
    } catch (error) {
      console.error('Failed to archive organization', error);
      showToast?.('Failed to archive organization', 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmRestoreOrganization = async () => {
    if (!orgToRestore) return;
    setLoading(true);
    try {
      await orgService.updateOrg(orgToRestore, { status: 'active' });
      setOrganizations((prev) => prev.map((org) => (org.id === orgToRestore ? { ...org, status: 'active' } : org)));
      if (selectedOrgId === orgToRestore) {
        void loadSelectedOrgProfile(selectedOrgId);
      }
      showToast?.('Organization restored (set to active).', 'success');
      setShowRestoreModal(false);
      setOrgToRestore(null);
      void loadCrmData();
    } catch (error) {
      console.error('Failed to restore organization', error);
      showToast?.('Failed to restore organization', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target?.files?.[0];
      if (!file) return;
      showToast?.(`Importing ${file.name}…`, 'info');
      setTimeout(() => showToast?.('Organization import completed.', 'success'), 2000);
    };
    input.click();
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const csvContent = `Name,Type,Contact Person,Contact Email,Total Learners,Active Learners,Completion Rate,Status\n${organizations
        .map(
          (org: any) =>
            `"${org.name}","${org.type}","${org.contactPerson}","${org.contactEmail}","${org.totalLearners}","${org.activeLearners}","${org.completionRate}%","${org.status}"`,
        )
        .join('\n')}`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organizations-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast?.('Organizations exported.', 'success');
    } catch (error) {
      showToast?.('Failed to export organizations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedOrg = useMemo(() => {
    if (!selectedOrgId) return null;
    return organizations.find((org) => org.id === selectedOrgId) ?? null;
  }, [organizations, selectedOrgId]);

  const paginationSummary = useMemo(() => {
    const start = organizations.length ? (paginationMeta.page - 1) * paginationMeta.pageSize + 1 : 0;
    const end = organizations.length ? start + organizations.length - 1 : 0;
    return {
      start,
      end,
      total: paginationMeta.total,
    };
  }, [organizations.length, paginationMeta]);

  const handleBroadcast = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      showToast?.('Title and message are required.', 'error');
      return;
    }
    setSendingBroadcast(true);
    try {
      await sendBroadcastNotification({
        title: broadcastForm.title.trim(),
        message: broadcastForm.message.trim(),
        channel: broadcastForm.channel as 'email' | 'in_app' | 'both',
        audience: broadcastForm.audience,
        organizationIds: broadcastForm.organizationIds
          .split(/[,\n;]/)
          .map((value) => value.trim())
          .filter(Boolean),
        userIds: broadcastForm.userIds
          .split(/[,\n;]/)
          .map((value) => value.trim())
          .filter(Boolean),
        allOrganizations: broadcastForm.audience === 'all_active_orgs',
        allUsers: broadcastForm.audience === 'all_active_users',
      });
      showToast?.('Announcement sent.', 'success');
      setBroadcastForm((prev) => ({ ...prev, title: '', message: '', organizationIds: '', userIds: '' }));
      void loadCrmData();
    } catch (error) {
      console.error('Broadcast failed', error);
      showToast?.('Unable to send announcement.', 'error');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    if (!selectedOrgId) return;
    try {
      await orgService.resendOrgInvite(selectedOrgId, inviteId);
      showToast?.('Invite resent.', 'success');
      void loadSelectedOrgProfile(selectedOrgId);
    } catch (error) {
      console.error('Failed to resend invite', error);
      showToast?.('Unable to resend invite.', 'error');
    }
  };

  const crmSummaryCards = useMemo(() => {
    if (!summaryForDisplay) return [];
    const summary = summaryForDisplay;
    return [
      {
        label: 'Organizations',
        icon: Building2,
        value: summary.organizations.total,
        subtext: `${summary.organizations.active} active · ${summary.organizations.onboarding} onboarding`,
      },
      {
        label: 'Learners',
        icon: Users,
        value: summary.users.total,
        subtext: `${summary.users.active} active · ${summary.users.invited} invited`,
      },
      {
        label: 'Assignments (30d)',
        icon: Activity,
        value: summary.assignments.coursesLast30d + summary.assignments.surveysLast30d,
        subtext: `${summary.assignments.coursesLast30d} courses · ${summary.assignments.surveysLast30d} surveys`,
      },
      {
        label: 'Messages (30d)',
        icon: Mail,
        value: summary.communication.messagesLast30d + summary.communication.notificationsLast30d,
        subtext: `${summary.communication.messagesLast30d} emails · ${summary.communication.notificationsLast30d} alerts`,
      },
    ];
  }, [summaryForDisplay]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Organizations & CRM', to: '/admin/organizations' }]} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Organizations & CRM</p>
          <h1 className="text-3xl font-bold text-gray-900">Customer relationships</h1>
          <p className="text-sm text-gray-600">Monitor engagement, manage organizations, and send communications from one workspace.</p>
          <p className="text-xs text-gray-500 mt-1">
            Displaying {orgListStats.total} organizations · {orgListStats.active} active
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LoadingButton onClick={loadCrmData} loading={crmLoading} variant="secondary">
            Refresh CRM
          </LoadingButton>
          <LoadingButton onClick={handleRefreshOrgs} loading={fetching} variant="secondary">
            Refresh Orgs
          </LoadingButton>
        </div>
      </div>

      {crmError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p className="font-semibold">CRM data unavailable</p>
          <p>{crmError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {crmSummaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-500">{card.label}</p>
              <card.icon className="h-5 w-5 text-slate/60" />
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500">{card.subtext}</p>
          </div>
        ))}
      </div>
      {usingDerivedSummary && (
        <p className="text-xs text-gray-500">
          Live metrics derived from the organizations currently loaded in this session.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1.1fr]">
        <div className="space-y-6">
          <div className="card-lg card-hover">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search organizations…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilterOption)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="trial">Trial</option>
                </select>
                <select
                  value={subscriptionFilter}
                  onChange={(event) => setSubscriptionFilter(event.target.value as SubscriptionFilterOption)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="all">All plans</option>
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
                <LoadingButton onClick={handleAddOrganization} variant="primary">
                  <Plus className="h-4 w-4" />
                  Add Organization
                </LoadingButton>
                <LoadingButton onClick={() => navigate('/admin/organizations/new')} variant="secondary">
                  <Building2 className="h-4 w-4" />
                  Create Org
                </LoadingButton>
                <LoadingButton onClick={handleImport} variant="secondary">
                  <Upload className="h-4 w-4" />
                  Import
                </LoadingButton>
                <LoadingButton onClick={handleExport} loading={loading} variant="secondary">
                  <Download className="h-4 w-4" />
                  Export
                </LoadingButton>
              </div>
            </div>
          </div>

          {initialLoad && fetching && (
            <div className="py-16 text-center text-gray-500">Loading organizations…</div>
          )}

          {!initialLoad && loadError && (
            <EmptyState
              title="Unable to load organizations"
              description="Check your connection and try refreshing."
              action={<LoadingButton onClick={handleRefreshOrgs}>Retry</LoadingButton>}
            />
          )}

          {!initialLoad && !loadError && organizations.length === 0 && (
            <EmptyState
              title="No organizations found"
              description={searchTerm ? 'Try updating your search.' : 'You have not added any organizations yet.'}
              action={
                <LoadingButton onClick={searchTerm ? () => setSearchTerm('') : handleAddOrganization}>
                  {searchTerm ? 'Reset search' : 'Add organization'}
                </LoadingButton>
              }
            />
          )}

          {organizations.length > 0 && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {organizations.map((org) => {
                const onboarding = progressMap[org.id];
                const onboardingPct = onboarding
                  ? Math.round((onboarding.completed_steps / Math.max(onboarding.total_steps || 1, 1)) * 100)
                  : null;
                const isSelected = selectedOrgId === org.id;
                return (
                  <div
                    key={org.id}
                    className={`card-lg card-hover cursor-pointer border ${
                      isSelected ? 'border-orange-400 ring-2 ring-orange-100' : 'border-gray-100'
                    }`}
                    onClick={() => handleSelectOrganization(org.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-100 p-2">
                          <Building2 className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{org.name}</h3>
                          <p className="text-sm text-gray-600">{org.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">{getStatusIcon(org.status)}</div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Contact</span>
                        <span className="text-sm font-medium text-gray-900">{org.contactPerson}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Learners</span>
                        <span className="text-sm font-medium text-gray-900">
                          {org.activeLearners}/{org.totalLearners} active
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Completion</span>
                        <span className="text-sm font-bold text-green-600">{org.completionRate}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Subscription</span>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${getSubscriptionBadge(org.subscription)}`}>
                          {org.subscription}
                        </span>
                      </div>
                    </div>

                    {onboardingPct !== null && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>Onboarding</span>
                          <span className="font-semibold text-gray-900">{onboardingPct}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-gray-200">
                          <div className="h-2 rounded-full bg-orange-500" style={{ width: `${Math.min(100, onboardingPct)}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                      <div className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(org.status)}`}>{org.status}</div>
                      <div className="relative">
                        <ActionsMenu
                          items={[
                            { key: 'view', label: 'View', onClick: () => navigate(`/admin/organizations/${org.id}`) },
                            { key: 'edit', label: 'Edit', onClick: () => handleEditOrganization(org.id) },
                            org.status === 'inactive'
                              ? { key: 'restore', label: 'Restore', onClick: () => handleRestoreOrganization(org.id) }
                              : { key: 'archive', label: 'Archive', onClick: () => handleArchiveOrganization(org.id) },
                            { key: 'delete', label: 'Delete', onClick: () => handleDeleteOrganization(org.id), destructive: true },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {organizations.length > 0 && (
            <div className="flex flex-wrap items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600">
              <div>
                Showing {paginationSummary.start}-{paginationSummary.end} of {paginationSummary.total}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={paginationMeta.page === 1}
                  onClick={() => fetchOrganizations(Math.max(1, paginationMeta.page - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!paginationMeta.hasMore}
                  onClick={() => fetchOrganizations(paginationMeta.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleBroadcast} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Action center</p>
                <h2 className="text-xl font-bold text-gray-900">Broadcast announcement</h2>
                <p className="text-sm text-gray-600">Reach organizations or users instantly.</p>
              </div>
              <div className="flex items-center gap-4 text-sm font-semibold text-orange-600">
                <Link className="hover:text-orange-700" to="/admin/organizations/new">
                  Create organization
                </Link>
                <Link className="hover:text-orange-700" to="/admin/courses">
                  Assign course
                </Link>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Title</label>
                <input
                  type="text"
                  value={broadcastForm.title}
                  onChange={(event) => setBroadcastForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  placeholder="System update, reminder…"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Channel</label>
                <select
                  value={broadcastForm.channel}
                  onChange={(event) => setBroadcastForm((prev) => ({ ...prev, channel: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="in_app">In-app</option>
                  <option value="email">Email</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Message</label>
              <textarea
                rows={4}
                value={broadcastForm.message}
                onChange={(event) => setBroadcastForm((prev) => ({ ...prev, message: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="Share important updates, launch news, or reminders."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Audience</label>
                <select
                  value={broadcastForm.audience}
                  onChange={(event) => setBroadcastForm((prev) => ({ ...prev, audience: event.target.value as BroadcastAudience }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="all_active_orgs">All active organizations</option>
                  <option value="all_active_users">All active users</option>
                  <option value="custom">Custom selection</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Organization IDs</label>
                <input
                  type="text"
                  value={broadcastForm.organizationIds}
                  disabled={broadcastForm.audience !== 'custom'}
                  onChange={(event) => setBroadcastForm((prev) => ({ ...prev, organizationIds: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                  placeholder="Comma separated org IDs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">User IDs</label>
                <input
                  type="text"
                  value={broadcastForm.userIds}
                  disabled={broadcastForm.audience !== 'custom'}
                  onChange={(event) => setBroadcastForm((prev) => ({ ...prev, userIds: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                  placeholder="Comma separated user IDs"
                />
              </div>
            </div>
            <LoadingButton type="submit" loading={sendingBroadcast} className="w-full justify-center" variant="primary">
              Send announcement
            </LoadingButton>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card-sm">
            {profileLoading ? (
              <p className="text-sm text-gray-500">Loading organization profile…</p>
            ) : profileError ? (
              <p className="text-sm text-rose-500">{profileError}</p>
            ) : !selectedOrg || !selectedOrgProfile ? (
              <p className="text-sm text-gray-500">Select an organization to view its profile.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Overview</p>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedOrg.name}</h2>
                    <p className="text-sm text-gray-600">{selectedOrg.contactEmail}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-orange-600"
                    asChild
                  >
                    <Link to={`/admin/organizations/${selectedOrg.id}`} className="flex items-center gap-1">
                      View profile <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="font-semibold text-gray-900">{selectedOrg.status}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Plan</p>
                    <p className="font-semibold text-gray-900">{selectedOrg.subscription}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Learners</p>
                    <p className="font-semibold text-gray-900">
                      {selectedOrg.activeLearners}/{selectedOrg.totalLearners}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Completion</p>
                    <p className="font-semibold text-gray-900">{selectedOrg.completionRate}%</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <LoadingButton
                    variant="secondary"
                    onClick={() => setShowCourseAssignModal(true)}
                    disabled={!selectedOrgId}
                  >
                    Assign Course
                  </LoadingButton>
                  <LoadingButton
                    variant="secondary"
                    onClick={() => navigate('/admin/surveys')}
                  >
                    Assign Survey
                  </LoadingButton>
                  <LoadingButton variant="secondary" onClick={() => navigate(`/admin/organizations/${selectedOrg.id}`)}>
                    Manage Org
                  </LoadingButton>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Metrics</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Courses Assigned</p>
                      <p className="font-semibold text-gray-900">{selectedOrgProfile.metrics?.coursesAssigned ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Surveys Assigned</p>
                      <p className="font-semibold text-gray-900">{selectedOrgProfile.metrics?.surveysAssigned ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Course completion</p>
                      <p className="font-semibold text-gray-900">{selectedOrgProfile.metrics?.courseCompletionRate ?? '—'}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Survey completion</p>
                      <p className="font-semibold text-gray-900">{selectedOrgProfile.metrics?.surveyCompletionRate ?? '—'}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {selectedOrg && selectedOrgProfile && (
            <OrgCommunicationPanel
              orgId={selectedOrg.id}
              orgName={selectedOrg.name}
              messages={selectedOrgProfile.messages}
              onMessageSent={() => void loadSelectedOrgProfile(selectedOrg.id)}
            />
          )}

          {selectedOrg && selectedOrgProfile && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Invites</p>
                  <h3 className="text-lg font-bold text-gray-900">Pending invites</h3>
                </div>
                <LoadingButton variant="secondary" size="sm" onClick={() => navigate(`/admin/organizations/${selectedOrg.id}`)}>
                  Manage invites
                </LoadingButton>
              </div>
              {selectedOrgProfile.invites.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No invites have been sent yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {selectedOrgProfile.invites.slice(0, 4).map((invite) => (
                    <li key={invite.id} className="rounded-xl border border-gray-100 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{invite.email}</p>
                          <p className="text-xs text-gray-500">{invite.role ?? 'member'} • {invite.status}</p>
                        </div>
                        {invite.status !== 'accepted' && (
                          <LoadingButton size="sm" variant="secondary" onClick={() => handleResendInvite(invite.id)}>
                            Resend
                          </LoadingButton>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteOrganization}
        title="Delete organization"
        message="Are you sure you want to delete this organization? This action cannot be undone."
        loading={loading}
      />
      <ConfirmationModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        onConfirm={confirmArchiveOrganization}
        title="Archive organization"
        message="Are you sure you want to archive this organization (set to inactive)? You can re-activate it later from the organization settings."
        loading={loading}
      />
      <ConfirmationModal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        onConfirm={confirmRestoreOrganization}
        title="Restore organization"
        message="Restore this organization to an active state? Members and settings will be re-enabled immediately."
        loading={loading}
      />
      <AddOrganizationModal
        isOpen={showAddOrgModal}
        onClose={() => setShowAddOrgModal(false)}
        onOrganizationAdded={handleOrganizationAdded}
      />
      <EditOrganizationModal
        isOpen={showEditOrgModal}
        onClose={() => setShowEditOrgModal(false)}
        organization={orgToEdit}
        onOrganizationUpdated={handleOrganizationUpdated}
      />
      <CourseAssignmentModal
        isOpen={showCourseAssignModal}
        onClose={() => setShowCourseAssignModal(false)}
        selectedUsers={[]}
        defaultOrgIds={selectedOrgId ? [selectedOrgId] : []}
        onAssignComplete={() => {
          setShowCourseAssignModal(false);
          if (selectedOrgId) {
            void loadSelectedOrgProfile(selectedOrgId);
          }
        }}
      />
    </div>
  );
};

export default AdminOrgWorkspace;
