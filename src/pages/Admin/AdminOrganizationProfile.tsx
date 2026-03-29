import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  Activity,
  Building2,
  ClipboardList,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  UserPlus2,
  Users as UsersIcon,
} from 'lucide-react';
import documentService from '../../dal/documents';
// client workspace DAL is dynamically imported where it can be bundled with the org-workspace chunk
import notificationService from '../../dal/notifications';
import orgService, { type OrgProfileDetails } from '../../dal/orgs';
import ConfirmationModal from '../../components/ConfirmationModal';
import { getOnboardingProgress } from '../../dal/onboarding';
import { useToast } from '../../context/ToastContext';
import OrgCommunicationPanel from '../../components/Admin/OrgCommunicationPanel';
import InviteManager from '../../components/onboarding/InviteManager';

// Simple logger for admin hardening events
const logAdminEvent = (event: string, meta: Record<string, any> = {}) => {
  // In production, replace with analytics or server log
  if (process.env.NODE_ENV === 'development') {
    console.info(`[ADMIN_LOG] ${event}`, meta);
  }
};

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'people', label: 'People' },
  { key: 'services', label: 'Services' },
  { key: 'resources', label: 'Resources' },
  { key: 'action-tracker', label: 'Action Tracker' },
  { key: 'metrics', label: 'Metrics' }
];

const formatDate = (value?: string | null, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', options).format(date);
};

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined) return '—';
  if (Number.isNaN(value)) return '—';
  return `${Math.round(value)}%`;
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString();
};

const normalizeBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return !!value;
};

const AdminOrganizationProfile: React.FC = () => {
  const params = useParams<{ organizationId?: string }>();
  const orgId = params.organizationId ?? null;
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [profile, setProfile] = useState<OrgProfileDetails | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState<boolean>(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [strategicPlansCount, setStrategicPlansCount] = useState<number>(0);
  const [totalLearners, setTotalLearners] = useState<number | null>(null);
  const [avgCompletion, setAvgCompletion] = useState<number | null>(null);
  const [totalDownloads, setTotalDownloads] = useState<number>(0);
  const [onboardingProgress, setOnboardingProgress] = useState<any | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState<boolean>(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState<string>('');
  const [docCategory, setDocCategory] = useState<string>('Onboarding');
  const [docTags, setDocTags] = useState<string>('');
  const [docUrl, setDocUrl] = useState<string>('');

  // Action item form
  const [newActionTitle, setNewActionTitle] = useState<string>('');
  const [newActionDue, setNewActionDue] = useState<string>('');
  const [newActionAssignee, setNewActionAssignee] = useState<string>('');

  const loadProfile = useCallback(async () => {
    if (!orgId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await orgService.getOrgProfileDetails(orgId);
      setProfile(data);
    } catch (error) {
      console.error('[AdminOrganizationProfile] failed to load profile', error);
      setProfile(null);
      setProfileError('Unable to load organization details right now.');
    } finally {
      setProfileLoading(false);
    }
  }, [orgId]);

useEffect(() => {
  void loadProfile();
}, [loadProfile]);

  const confirmRestoreOrg = async () => {
    if (!orgId) return;
    setRestoring(true);
    try {
      await orgService.updateOrg(orgId, { status: 'active' });
      showToast('Organization restored.', 'success');
      await loadProfile();
    } catch (error) {
      console.error('[AdminOrganizationProfile] restore failed', error);
      showToast('Failed to restore organization.', 'error');
    } finally {
      setRestoring(false);
      setShowRestoreConfirm(false);
    }
  };

  useEffect(() => {
    if (!orgId) {
      setOnboardingProgress(null);
      return;
    }
    let cancelled = false;
    setOnboardingLoading(true);
    setOnboardingError(null);
    getOnboardingProgress(orgId)
      .then((response) => {
        if (cancelled) return;
        setOnboardingProgress(response?.data ?? null);
      })
      .catch((error) => {
        console.warn('[AdminOrganizationProfile] onboarding progress failed', error);
        if (cancelled) return;
        setOnboardingProgress(null);
        setOnboardingError('Unable to load onboarding progress.');
      })
      .finally(() => {
        if (!cancelled) {
          setOnboardingLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);
  const refreshDocuments = useCallback(async () => {
    if (!orgId) {
      setDocuments([]);
      setTotalDownloads(0);
      setDocumentsError(null);
      setDocumentsLoading(false);
      return;
    }
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const list = await documentService.listDocuments({ organizationId: orgId });
      setDocuments(list);
      setTotalDownloads(list.reduce((acc, doc) => acc + (doc.downloadCount || 0), 0));
    } catch (error) {
      console.error('[AdminOrganizationProfile] document load failed', error);
      setDocuments([]);
      setTotalDownloads(0);
      setDocumentsError('Unable to load shared resources at the moment.');
    } finally {
      setDocumentsLoading(false);
    }
  }, [orgId]);

  const refreshActionItems = useCallback(async () => {
    if (!orgId) {
      setActionItems([]);
      setStrategicPlansCount(0);
      setActionError(null);
      setActionLoading(false);
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const svc = await import('../../dal/clientWorkspace');
      const [actions, plans] = await Promise.all([
        svc.listActionItems(orgId),
        svc.listStrategicPlans(orgId),
      ]);
      setActionItems(actions);
      setStrategicPlansCount(plans.length);
    } catch (error) {
      console.error('[AdminOrganizationProfile] action tracker load failed', error);
      setActionItems([]);
      setStrategicPlansCount(0);
      setActionError('Unable to load internal action items.');
    } finally {
      setActionLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refreshDocuments();
    void refreshActionItems();
  }, [refreshDocuments, refreshActionItems]);

  useEffect(() => {
    if (!profile?.organization) {
      setTotalLearners(null);
      setAvgCompletion(null);
      return;
    }
    setTotalLearners(profile.organization.totalLearners ?? profile.metrics?.totalUsers ?? null);
    setAvgCompletion(profile.organization.completionRate ?? profile.metrics?.courseCompletionRate ?? null);
  }, [profile]);

  const handleFileChange = (f: File | null) => setFile(f);

  const handleUpload = async () => {
    if (!orgId) return;
    if (!file && !docUrl) {
      showToast('Upload a file or provide a resource link.', 'error');
      return;
    }

    try {
      const doc = await documentService.addDocument({
        name: docName || file?.name || 'Untitled Resource',
        filename: file?.name,
        url: docUrl || undefined,
        category: docCategory,
        subcategory: undefined,
        tags: docTags ? docTags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        fileType: file?.type,
        visibility: 'org',
        organizationId: orgId!,
        createdBy: 'Admin',
      } as any, file || undefined);

      if (doc?.id) {
        await documentService.assignToOrg(doc.id, orgId!);
        await notificationService.addNotification({
          title: 'New Resource Shared',
          body: `"${doc.name}" is now available to your learners.`,
          organizationId: orgId!,
        } as any);
        setDocName('');
        setDocTags('');
        setDocUrl('');
        setFile(null);
        await refreshDocuments();
        showToast('Resource shared successfully.', 'success');
      }
    } catch (error) {
      console.error('[AdminOrganizationProfile] resource upload failed', error);
      showToast('Unable to share resource right now.', 'error');
    }
  };

  const handleAddAction = async () => {
    if (!orgId || !newActionTitle) {
      showToast('Provide a title for the action', 'error');
      return;
    }
    const svc = await import('../../dal/clientWorkspace');
    await svc.addActionItem(orgId, {
      title: newActionTitle,
      description: '',
      assignee: newActionAssignee || undefined,
      dueDate: newActionDue || undefined,
      status: 'Not Started',
    } as any);
    setNewActionTitle('');
    setNewActionDue('');
    setNewActionAssignee('');
    await refreshActionItems();
    showToast('Action item added', 'success');
  };

  const toggleActionStatus = async (item: any) => {
    if (!orgId) return;
    const order = ['Not Started', 'In Progress', 'Completed'];
    const idx = order.indexOf(item.status || 'Not Started');
    const next = order[(idx + 1) % order.length] as any;
    const updated = { ...item, status: next };
    const svc2 = await import('../../dal/clientWorkspace');
    await svc2.updateActionItem(orgId, updated);
    await refreshActionItems();
  };

  const renderOverview = () => {
    if (profileLoading) {
      return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col items-center justify-center py-8">
            <LoadingSpinner />
            <span className="mt-2 text-sm text-gray-500">Loading organization profile...</span>
          </div>
        </div>
      );
    }

    if (profileError) {
      return (
        <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm">
          <p className="text-red-700 font-medium mb-3">{profileError}</p>
          <Button size="sm" onClick={loadProfile}>
            Retry
          </Button>
        </div>
      );
    }

    if (!profile || !profile.organization) {
      return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-gray-600">This organization record could not be found.</p>
          <Button asChild variant="ghost" size="sm" className="mt-3">
            <Link to="/admin/organizations">Back to Organizations</Link>
          </Button>
        </div>
      );
    }

    const { organization, metrics, contacts = [], admins = [], invites = [], messages = [], assignments, lastContacted, users = [] } =
      profile;
    const primaryContact = contacts.find((contact) => contact.isPrimary) ?? contacts[0] ?? null;
    const addressParts = [
      organization.address,
      organization.city,
      organization.state,
      organization.postalCode,
      organization.country,
    ].filter(Boolean);
    const summaryCards = [
      { label: 'Status', value: organization.status ?? '—' },
      { label: 'Subscription', value: organization.subscription ?? '—' },
      { label: 'Total Users', value: formatNumber(metrics?.totalUsers) },
      { label: 'Active Users', value: formatNumber(metrics?.activeUsers) },
      { label: 'Courses Assigned', value: formatNumber(metrics?.coursesAssigned) },
      { label: 'Surveys Assigned', value: formatNumber(metrics?.surveysAssigned) },
      { label: 'Course Completion', value: formatPercent(metrics?.courseCompletionRate) },
      { label: 'Survey Completion', value: formatPercent(metrics?.surveyCompletionRate) },
    ];
    const assignmentBuckets = [
      { key: 'courses', label: 'Courses', bucket: assignments?.courses },
      { key: 'surveys', label: 'Surveys', bucket: assignments?.surveys },
    ];
    const recentInvites = invites.slice(0, 4);
    const recentMessages = messages.slice(0, 4);
    const topAdmins = admins.slice(0, 5);
    const onboardingSteps = onboardingProgress?.steps ?? [];
    const onboardingSummary = onboardingProgress?.summary ?? null;
    const completedSteps = onboardingSteps.filter((step: any) => step.status === 'completed').length;
    const onboardingTotal = onboardingSteps.length || 1;
    const onboardingStatus = onboardingSummary?.status ?? organization.onboardingStatus ?? 'pending';

    const onboardingStatusTone =
      onboardingStatus === 'completed'
        ? 'bg-emerald-100 text-emerald-700'
        : onboardingStatus === 'in_progress'
          ? 'bg-skyblue/20 text-skyblue-dark'
          : 'bg-amber-100 text-amber-800';

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-blue-50 p-4">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-gray-500 mb-1">Organization</p>
              <h2 className="text-2xl font-bold text-gray-900">{organization.name ?? orgId}</h2>
              <p className="text-sm text-gray-500">
                {organization.type ?? 'Organization'} · Last activity {formatDate(organization.lastActivity)} ·{' '}
                {organization.onboardingStatus ? `Onboarding: ${organization.onboardingStatus}` : 'Onboarding ready'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/organizations">Back to list</Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={loadProfile}>
              Refresh data
            </Button>
            {profile?.organization?.status === 'inactive' && (
              <Button size="sm" variant="primary" onClick={() => setShowRestoreConfirm(true)}>
                Restore organization
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Onboarding progress</h3>
              <p className="text-sm text-gray-500">
                {completedSteps}/{onboardingTotal} steps ·{' '}
                {onboardingSummary?.current_step
                  ? `Next: ${onboardingSummary.current_step.replace(/[_-]/g, ' ')}`
                  : 'Awaiting kickoff'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {onboardingLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                  Syncing progress…
                </div>
              ) : onboardingError ? (
                <span className="text-sm text-rose-600">{onboardingError}</span>
              ) : null}
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${onboardingStatusTone}`}>
                {onboardingStatus.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {(onboardingSteps.length ? onboardingSteps : [{ step: 'org_created', status: 'completed' }]).map((step: any) => {
              const isDone = step.status === 'completed';
              const isBlocked = step.status === 'blocked';
              const badgeClass = isDone
                ? 'bg-emerald-100 text-emerald-700'
                : isBlocked
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-gray-100 text-gray-600';
              return (
                <div
                  key={`${step.id ?? step.step}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{(step.label ?? step.step ?? '').replace(/[_-]/g, ' ') || 'Step'}</p>
                    <p className="text-xs text-gray-500">
                      {step.completed_at
                        ? `Completed ${formatDate(step.completed_at)}`
                        : step.status === 'in_progress'
                          ? 'In progress'
                          : 'Pending'}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                    {step.status?.replace(/_/g, ' ') ?? 'pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-500">{card.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Organization details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p className="text-gray-500">Type</p>
                <p className="font-medium text-gray-900">{organization.type ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Plan</p>
                <p className="font-medium text-gray-900">{organization.subscription ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Max learners</p>
                <p className="font-medium text-gray-900">{formatNumber(organization.maxLearners)}</p>
              </div>
              <div>
                <p className="text-gray-500">Timezone</p>
                <p className="font-medium text-gray-900">{organization.timezone ?? '—'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-500 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Address
                </p>
                <p className="font-medium text-gray-900">{addressParts.length > 0 ? addressParts.join(', ') : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Phone
                </p>
                <p className="font-medium text-gray-900">{organization.contactPhone ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Website
                </p>
                {organization.website ? (
                  <a href={organization.website} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    {organization.website}
                  </a>
                ) : (
                  <p className="font-medium text-gray-900">—</p>
                )}
              </div>
              <div>
                <p className="text-gray-500">Created</p>
                <p className="font-medium text-gray-900">{formatDate(organization.createdAt)}</p>
              </div>
              <div>
                <p className="text-gray-500">Last updated</p>
                <p className="font-medium text-gray-900">{formatDate(organization.updatedAt)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Primary contact</h3>
            {primaryContact ? (
              <div className="space-y-2 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">{primaryContact.name}</p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${primaryContact.email}`} className="text-blue-600 underline">
                    {primaryContact.email}
                  </a>
                </p>
                {primaryContact.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a href={`tel:${primaryContact.phone}`} className="text-blue-600 underline">
                      {primaryContact.phone}
                    </a>
                  </p>
                )}
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {primaryContact.role || 'Contact'} {primaryContact.isPrimary ? '• Primary' : null}
                </p>
              </div>
            ) : (
              <p className="text-gray-600 text-sm">Add a contact to personalize outreach.</p>
            )}

            {contacts.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs uppercase text-gray-500 mb-2">Other contacts</p>
                <ul className="space-y-2 text-sm text-gray-700 max-h-32 overflow-auto">
                  {contacts
                    .filter((contact) => contact !== primaryContact)
                    .map((contact) => (
                      <li key={contact.id} className="flex flex-col">
                        <span className="font-medium text-gray-900">{contact.name ?? contact.email}</span>
                        <span className="text-gray-500">{contact.role ?? contact.email}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-gray-400" /> Admin users
              </h3>
              <span className="text-sm text-gray-500">{admins.length} admins</span>
            </div>
            {topAdmins.length === 0 ? (
              <p className="text-sm text-gray-600">No admins recorded for this organization.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {topAdmins.map((admin) => (
                  <li key={`${admin.membershipId}-${admin.userId}`} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{admin.name ?? admin.email ?? 'Unknown'}</p>
                      <p className="text-gray-500">{admin.email}</p>
                    </div>
                    <div className="text-right text-gray-500">
                      <p className="text-xs uppercase tracking-wide">{admin.role ?? 'member'}</p>
                      <p className="text-xs">Last login {formatDate(admin.lastLoginAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-gray-400" /> Assignments snapshot
              </h3>
              <span className="text-sm text-gray-500">Generated {formatDate(assignments?.generatedAt)}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignmentBuckets.map(({ key, label, bucket }) => (
                <div key={key} className="rounded-lg border border-gray-100 p-4">
                  <p className="text-xs uppercase text-gray-500 mb-1">{label}</p>
                  <p className="text-3xl font-semibold text-gray-900">{formatNumber(bucket?.assignmentCount)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Due soon {formatNumber(bucket?.dueSoonCount)} • Completed {formatNumber(bucket?.completedCount)}
                  </p>
                  {bucket?.topAssignments?.length ? (
                    <ul className="mt-3 space-y-1 text-sm text-gray-600">
                      {bucket.topAssignments.slice(0, 3).map((item) => (
                        <li key={`${label}-${item.id}`}>
                          <span className="font-medium text-gray-900">{item.title ?? 'Untitled'}</span>
                          <span className="text-xs text-gray-500 block">
                            {item.status ?? 'pending'} · Due {formatDate(item.dueAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500 mt-3">No {label.toLowerCase()} assignments found.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-gray-400" /> Learners & members
            </h3>
            <span className="text-sm text-gray-500">{users.length} total</span>
          </div>
          {users.length === 0 ? (
            <p className="text-sm text-gray-600">Invite members to see a roster preview here.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {users.slice(0, 6).map((user) => (
                <li key={`${user.userId ?? user.email}`} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{user.name ?? user.email ?? 'Unknown user'}</p>
                    <p className="text-xs text-gray-500">{user.email || 'No email on file'}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p className="uppercase tracking-wide">{user.role ?? 'member'}</p>
                    <p>{user.status ?? 'active'}</p>
                    <p>Last seen {formatDate(user.lastSeenAt ?? user.updatedAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Showing the six most recent members.</span>
            <Link
              to={orgId ? `/admin/users?focusOrg=${orgId}` : '/admin/users'}
              className="font-semibold text-blue-600 hover:underline"
            >
              Open people list
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <UserPlus2 className="h-5 w-5 text-gray-400" /> Recent invites
              </h3>
              <span className="text-xs text-gray-500">{invites.length} total</span>
            </div>
            {recentInvites.length === 0 ? (
              <p className="text-sm text-gray-600">No invites sent yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm text-gray-700">
                {recentInvites.map((invite) => (
                  <li key={invite.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{invite.email}</p>
                      <p className="text-gray-500 text-xs">
                        {invite.role ?? 'member'} • {invite.status} • Sent {formatDate(invite.invitedAt)}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">Expires {formatDate(invite.expiresAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-gray-400" /> Communication history
              </h3>
              <span className="text-xs text-gray-500">
                {lastContacted ? `Last touched ${formatDate(lastContacted)}` : 'No contact recorded'}
              </span>
            </div>
            {recentMessages.length === 0 ? (
              <p className="text-sm text-gray-600">No messages or notifications have been sent to this organization.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm text-gray-700">
                {recentMessages.map((message) => (
                  <li key={message.id} className="py-3">
                    <p className="font-medium text-gray-900">{message.subject ?? 'Untitled message'}</p>
                    <p className="text-gray-500 text-xs">
                      {message.channel ?? 'email'} • {message.status ?? 'sent'} • {formatDate(message.sentAt)}
                    </p>
                    <p className="text-gray-600 mt-1">{message.body ?? 'No message body recorded.'}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-400" /> Organization health
            </h3>
            <span className="text-xs text-gray-500">Alerts synced via CRM</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <p className="text-xs uppercase text-gray-500">Alerts</p>
              <p className="font-medium text-gray-900">
                {recentMessages.length > 0 ? 'Communication active' : 'No recent messages'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Assignments</p>
              <p className="font-medium text-gray-900">
                {assignmentBuckets.every(({ bucket }) => (bucket?.assignmentCount ?? 0) === 0)
                  ? 'No open assignments'
                  : 'Active assignments in progress'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Invites</p>
              <p className="font-medium text-gray-900">
                {recentInvites.length > 0 ? `${recentInvites.length} invite(s) pending` : 'No pending invites'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPeople = () => {
    if (!orgId) {
      return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-gray-600">Organization ID not found.</p>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-1">Invite &amp; manage members</h3>
          <p className="text-sm text-gray-500 mb-4">
            Send email invites, bulk-upload members, and track invite status for{' '}
            {profile?.organization?.name ?? 'this organization'}.
          </p>
          <InviteManager orgId={orgId} mode="admin" />
        </div>
      </div>
    );
  };

  const renderServices = () => {
    if (profileLoading) {
      return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-col items-center justify-center py-8">
            <LoadingSpinner />
            <span className="mt-2 text-sm text-gray-500">Loading services…</span>
          </div>
        </div>
      );
    }
    if (!profile) {
      return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-gray-600">Select an organization to view service settings.</p>
        </div>
      );
    }
    const features = profile.organization.features || {};
    const settings = profile.organization.settings || {};
    const modules = profile.organization.modules || {};
    const featureEntries = Object.entries(features);
    const settingEntries = Object.entries(settings);
    const moduleEntries = Object.entries(modules).filter(([_, value]) => typeof value === 'number' && value > 0);

    const badgeClass = (enabled: boolean) =>
      enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500';

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Feature access</h3>
            <p className="text-xs text-gray-500">Mirrors feature flags stored on the organization record.</p>
          </div>
          {featureEntries.length === 0 ? (
            <p className="text-sm text-gray-500">No optional modules have been enabled for this organization yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featureEntries.map(([key, value]) => {
                const enabled = normalizeBoolean(value);
                return (
                  <div key={key} className="rounded-lg border border-gray-100 p-4">
                    <p className="text-sm font-semibold capitalize text-gray-900">{key.replace(/([A-Z])/g, ' $1')}</p>
                    <p className="text-xs text-gray-500">Controls toolkit availability for this tenant.</p>
                    <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(enabled)}`}>
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-4">Org settings</h3>
          {settingEntries.length === 0 ? (
            <p className="text-sm text-gray-500">No custom settings stored for this organization.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
              {settingEntries.map(([key, value]) => (
                <div key={key} className="rounded-lg border border-gray-100 p-4">
                  <p className="text-xs uppercase text-gray-500">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="font-medium text-gray-900">{typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : String(value ?? '—')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-4">Active modules</h3>
          {moduleEntries.length === 0 ? (
            <p className="text-sm text-gray-500">Module usage metrics will appear after learners engage with courses and surveys linked to premium modules.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {moduleEntries.map(([module, count]) => (
                <div key={module} className="rounded-lg border border-gray-100 p-4 text-center">
                  <p className="text-xs uppercase text-gray-500">{module}</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(Number(count))}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderResources = () => {
    const orgDocuments = documents.filter((doc) => doc.visibility === 'org' && doc.organizationId === orgId);
    const sharedDocuments = documents.filter((doc) => doc.visibility === 'global');

    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-bold text-lg">Resources</h3>
            <p className="text-sm text-gray-500">Share playbooks, onboarding packets, and reference documents with {profile?.organization?.name ?? 'this organization'}.</p>
          </div>
          <p className="text-xs text-gray-500">Total downloads tracked: {formatNumber(totalDownloads)}</p>
        </div>

        {documentsError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{documentsError}</div>
        ) : null}

        {documentsLoading ? (
          <div className="rounded-lg border border-gray-100 bg-white p-8 text-center">
            <div className="flex flex-col items-center justify-center py-8">
              <LoadingSpinner />
              <span className="mt-2 text-sm text-gray-500">Loading shared resources…</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-100 p-4 lg:col-span-2 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Shared with this organization</h4>
                {orgDocuments.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-2">No org-specific resources yet. Upload a file or link below.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-gray-100">
                    {orgDocuments.map((doc) => (
                      <li key={doc.id} className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          <p className="text-xs text-gray-500">
                            {doc.category} • {formatDate(doc.createdAt)} • {doc.downloadCount ?? 0} downloads
                          </p>
                        </div>
                        {doc.url ? (
                          <a
                            className="text-sm font-medium text-blue-600 hover:underline"
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">No download URL</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900">Global library</h4>
                {sharedDocuments.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-2">Global resources will appear here once uploaded.</p>
                ) : (
                  <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {sharedDocuments.slice(0, 6).map((doc) => (
                      <li key={doc.id} className="rounded-lg border border-gray-100 p-3 text-sm text-gray-700">
                        <p className="font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.category}</p>
                        {doc.url && (
                          <a
                            className="mt-2 inline-flex text-xs font-semibold text-blue-600 hover:underline"
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View resource
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 p-4">
              <div className="text-sm font-medium mb-2">Upload or link a resource</div>
              <input
                type="text"
                placeholder="Resource name"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="w-full mb-2 p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Category"
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="w-full mb-2 p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Tags (comma separated)"
                value={docTags}
                onChange={(e) => setDocTags(e.target.value)}
                className="w-full mb-2 p-2 border rounded"
              />
              <input
                type="url"
                placeholder="External resource URL"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                className="w-full mb-2 p-2 border rounded"
              />
              <input
                type="file"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="w-full mb-2"
              />
              <p className="text-xs text-gray-500 mb-3">Upload a file or provide a secure URL. Learners receive a notification automatically.</p>
              <div className="text-right">
                <button
                  type="button"
                  onClick={handleUpload}
                  className="px-3 py-1 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded"
                  disabled={documentsLoading}
                >
                  Share resource
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderActionTracker = () => {
    const steps = onboardingProgress?.steps ?? [];
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Activation checklist</h3>
            {onboardingLoading && <span className="text-xs text-gray-500">Syncing…</span>}
          </div>
          {steps.length === 0 ? (
            <p className="text-sm text-gray-500">
              No onboarding steps recorded yet. Create an organization via the wizard to seed milestones.
            </p>
          ) : (
            <ul className="space-y-3">
              {steps.map((step: any) => {
                const done = step.status === 'completed';
                const blocked = step.status === 'blocked';
                return (
                  <li key={step.id ?? step.step} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{(step.label ?? step.step ?? '').replace(/[_-]/g, ' ')}</p>
                      <p className="text-xs text-gray-500">
                        {done ? `Completed ${formatDate(step.completed_at)}` : step.status === 'in_progress' ? 'In progress' : 'Pending'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        done ? 'bg-emerald-100 text-emerald-700' : blocked ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {step.status ?? 'pending'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Custom action items</h3>
            {actionError ? <span className="text-xs text-rose-600">{actionError}</span> : null}
          </div>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
            <input value={newActionTitle} onChange={(e) => setNewActionTitle(e.target.value)} placeholder="Action title" className="p-2 border rounded" />
            <input value={newActionDue} onChange={(e) => setNewActionDue(e.target.value)} placeholder="Due date" type="date" className="p-2 border rounded" />
            <input value={newActionAssignee} onChange={(e) => setNewActionAssignee(e.target.value)} placeholder="Assignee" className="p-2 border rounded" />
            <div className="md:col-span-3 text-right">
              <button type="button" onClick={handleAddAction} className="px-3 py-1 bg-blue-600 text-white rounded">Add Action</button>
            </div>
          </div>

          {actionLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <LoadingSpinner />
              <span className="mt-2 text-sm text-gray-500">Loading action items…</span>
            </div>
          ) : actionItems.length === 0 ? (
            <div className="text-sm text-gray-500">No action items for this organization.</div>
          ) : (
            <ul className="space-y-2">
              {actionItems.map((item) => (
                <li key={item.id} className="p-3 border rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-600">Due: {item.dueDate || '—'}</div>
                    <div className="text-xs text-gray-500">Assignee: {item.assignee || 'Unassigned'}</div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <div
                      className={`px-2 py-1 rounded-full text-sm ${
                        item.status === 'Completed'
                          ? 'bg-green-100 text-green-800'
                          : item.status === 'In Progress'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {item.status}
                    </div>
                    <div className="flex space-x-2">
                      <button type="button" onClick={() => toggleActionStatus(item)} className="px-2 py-1 bg-white border rounded text-sm">
                        Toggle Status
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const renderMetrics = () => {
    const metrics = profile?.metrics;
    const assignments = profile?.assignments;
    const courseBucket = assignments?.courses;
    const surveyBucket = assignments?.surveys;
    const completionPercent = formatPercent(metrics?.courseCompletionRate ?? avgCompletion ?? null);
    const surveyCompletionPercent = formatPercent(metrics?.surveyCompletionRate ?? null);
    const actionCompletion =
      actionItems.length === 0
        ? '—'
        : `${Math.round((actionItems.filter((a) => a.status === 'Completed').length / actionItems.length) * 100)}%`;

    const summaryCards = [
      { label: 'Total users', value: formatNumber(metrics?.totalUsers ?? totalLearners) },
      { label: 'Active users', value: formatNumber(metrics?.activeUsers ?? profile?.organization?.activeLearners ?? null) },
      { label: 'Course assignments', value: formatNumber(courseBucket?.assignmentCount ?? 0) },
      { label: 'Survey assignments', value: formatNumber(surveyBucket?.assignmentCount ?? 0) },
      { label: 'Course completion', value: completionPercent },
      { label: 'Survey completion', value: surveyCompletionPercent },
      { label: 'Documents shared', value: formatNumber(documents.length) },
      { label: 'Downloads', value: formatNumber(totalDownloads) },
    ];

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-4">Engagement snapshot</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-lg border border-gray-100 bg-white p-4 text-center">
                <p className="text-xs uppercase text-gray-500">{card.label}</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">{card.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-4">Assignment pipeline</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Courses</p>
              <p className="text-sm text-gray-500 mb-4">
                Due soon {formatNumber(courseBucket?.dueSoonCount ?? 0)} • Completed {formatNumber(courseBucket?.completedCount ?? 0)}
              </p>
              {courseBucket?.topAssignments?.length ? (
                <ul className="space-y-2 text-sm text-gray-700">
                  {courseBucket.topAssignments.slice(0, 4).map((item) => (
                    <li key={item.id} className="rounded border border-gray-100 p-2">
                      <span className="font-medium text-gray-900">{item.title ?? 'Untitled'}</span>
                      <span className="block text-xs text-gray-500">
                        {item.status ?? 'pending'} • Due {formatDate(item.dueAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No course assignments captured yet.</p>
              )}
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Surveys</p>
              <p className="text-sm text-gray-500 mb-4">
                Due soon {formatNumber(surveyBucket?.dueSoonCount ?? 0)} • Completed {formatNumber(surveyBucket?.completedCount ?? 0)}
              </p>
              {surveyBucket?.topAssignments?.length ? (
                <ul className="space-y-2 text-sm text-gray-700">
                  {surveyBucket.topAssignments.slice(0, 4).map((item) => (
                    <li key={item.id} className="rounded border border-gray-100 p-2">
                      <span className="font-medium text-gray-900">{item.title ?? 'Untitled'}</span>
                      <span className="block text-xs text-gray-500">
                        {item.status ?? 'pending'} • Due {formatDate(item.dueAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No survey assignments captured yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-2">Internal plan tracking</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs uppercase text-gray-500">Action items</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">{formatNumber(actionItems.length)}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs uppercase text-gray-500">Action completion</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">{actionCompletion}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs uppercase text-gray-500">Strategic plans</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">{formatNumber(strategicPlansCount)}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs uppercase text-gray-500">Avg completion</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">{completionPercent}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Log when org profile section loads
  useEffect(() => {
    if (profile && orgId) {
      logAdminEvent('organization_profile_section_loaded', { orgId, userId: profile.organization?.owner || undefined, route: window.location.pathname });
    }
    if (profile === null && !profileLoading && orgId) {
      logAdminEvent('organization_profile_section_empty', { orgId, route: window.location.pathname });
    }
  }, [profile, orgId, profileLoading]);

  // Log resource loading
  useEffect(() => {
    if (documents && documents.length > 0 && orgId) {
      logAdminEvent('learner_resources_loaded', { orgId, count: documents.length });
    }
    if (documentsError && orgId) {
      logAdminEvent('learner_resources_failed', { orgId, error: documentsError });
    }
  }, [documents, documentsError, orgId]);

  // Log onboarding progress
  useEffect(() => {
    if (onboardingProgress && orgId) {
      logAdminEvent('onboarding_success_rendered', { orgId, route: window.location.pathname });
    }
    if (onboardingError && orgId) {
      logAdminEvent('onboarding_org_match_failed', { orgId, error: onboardingError });
    }
  }, [onboardingProgress, onboardingError, orgId]);

  // Example: log admin_dead_action_removed and admin_nav_item_disabled where you remove/disable dead actions/navs
  // logAdminEvent('admin_dead_action_removed', { action: 'Edit Organization', orgId });
  // logAdminEvent('admin_nav_item_disabled', { nav: 'Performance', orgId });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organization Profile</h1>
          <p className="text-sm text-gray-600">Manage organization details, resources and activity.</p>
        </div>
      </div>

      <div className="mb-6">
        <nav className="flex space-x-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg ${activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'people' && renderPeople()}
        {activeTab === 'services' && renderServices()}
        {activeTab === 'resources' && renderResources()}
        {activeTab === 'action-tracker' && renderActionTracker()}
        {activeTab === 'metrics' && renderMetrics()}
        {activeTab === 'overview' && profile?.organization && (
          <OrgCommunicationPanel
            orgId={profile.organization.id}
            orgName={profile.organization.name}
            messages={profile.messages ?? []}
            onMessageSent={() => void loadProfile()}
          />
        )}
      </div>
        <ConfirmationModal
          isOpen={showRestoreConfirm}
          onClose={() => setShowRestoreConfirm(false)}
          onConfirm={confirmRestoreOrg}
          title="Restore organization"
          message="Restore this organization to an active state? This will re-enable learners and settings immediately."
          loading={restoring}
        />
    </div>
  );
};

export default AdminOrganizationProfile;
