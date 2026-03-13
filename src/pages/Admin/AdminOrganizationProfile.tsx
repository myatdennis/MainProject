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
// client workspace DAL is dynamically imported where used so it can be bundled with the org-workspace chunk
import notificationService from '../../dal/notifications';
import orgService from '../../dal/orgs';
import { useToast } from '../../context/ToastContext';
import type { OrgProfileDetails } from '../../services/orgService';

const tabs = [
  { key: 'overview', label: 'Overview' },
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

const AdminOrganizationProfile: React.FC = () => {
  const params = useParams<{ organizationId?: string }>();
  const orgId = params.organizationId ?? null;
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [profile, setProfile] = useState<OrgProfileDetails | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [strategicPlansCount, setStrategicPlansCount] = useState<number>(0);
  const [totalLearners, setTotalLearners] = useState<number | null>(null);
  const [avgCompletion, setAvgCompletion] = useState<number | null>(null);
  const [totalDownloads, setTotalDownloads] = useState<number>(0);

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState<string>('');
  const [docCategory, setDocCategory] = useState<string>('Onboarding');
  const [docTags, setDocTags] = useState<string>('');

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

  useEffect(() => {
    if (!orgId) return;
    const hydrateDocuments = async () => {
      try {
        const list = await documentService.listDocuments({ organizationId: orgId });
        setDocuments(list);
        setTotalDownloads(list.reduce((acc, doc) => acc + (doc.downloadCount || 0), 0));
      } catch {
        setDocuments([]);
        setTotalDownloads(0);
      }
    };
    hydrateDocuments();

    (async () => {
      try {
        const svc = await import('../../dal/clientWorkspace');
        const actions = await svc.listActionItems(orgId);
        setActionItems(actions);
        const plans = await svc.listStrategicPlans(orgId);
        setStrategicPlansCount(plans.length);
      } catch (e) {
        setActionItems([]);
        setStrategicPlansCount(0);
      }
    })();

    orgService
      .getOrg(orgId)
      .then((o) => {
        if (o) {
          setTotalLearners(o.totalLearners || 0);
          setAvgCompletion(o.completionRate || 0);
        } else {
          setTotalLearners(null);
          setAvgCompletion(null);
        }
      })
      .catch(() => {
        setTotalLearners(null);
        setAvgCompletion(null);
      });
  }, [orgId]);

  const handleAssignDocument = async () => {
    // quick demo: create a placeholder doc and assign to org
    const meta = await documentService.addDocument({
      name: `welcome-packet-${Date.now()}`,
      filename: 'welcome.pdf',
      url: undefined,
      category: 'Onboarding',
      subcategory: undefined,
      tags: ['welcome'],
      fileType: 'application/pdf',
      visibility: 'org',
  organizationId: orgId!,
      createdBy: 'Admin'
    } as any);
    if (meta && meta.id) {
      await documentService.assignToOrg(meta.id, orgId!);
      // notificationService API is addNotification and expects body
      await notificationService.addNotification({
        title: 'Document assigned',
        body: `Assigned ${meta.name} to organization ${orgId}`,
        organizationId: orgId!
      } as any);
      // refresh
  const list = await documentService.listDocuments({ organizationId: orgId });
      setDocuments(list);
    }
  };

  const handleFileChange = (f: File | null) => setFile(f);

  const handleUpload = async () => {
    if (!orgId) return;
    if (!file && !docName) {
      showToast('Provide a name or file', 'error');
      return;
    }

    const doc = await documentService.addDocument({
      name: docName || file?.name || 'Untitled Document',
      filename: file?.name,
      category: docCategory,
      subcategory: undefined,
      tags: docTags ? docTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      fileType: file?.type,
      visibility: 'org',
  organizationId: orgId!,
      createdBy: 'Admin'
    } as any, file || undefined);

    if (doc && doc.id) {
      await documentService.assignToOrg(doc.id, orgId!);
  await notificationService.addNotification({ title: 'New Document Shared', body: `A document "${doc.name}" was shared with your organization.`, organizationId: orgId! } as any);
      setDocName(''); setFile(null); setDocTags('');
  const list = await documentService.listDocuments({ organizationId: orgId });
      setDocuments(list);
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
      status: 'Not Started'
    } as any);
    setNewActionTitle(''); setNewActionDue(''); setNewActionAssignee('');
  const list = await (await import('../../dal/clientWorkspace')).listActionItems(orgId);
    setActionItems(list);
    showToast('Action item added', 'success');
  };

  const toggleActionStatus = async (item: any) => {
    if (!orgId) return;
    const order = ['Not Started','In Progress','Completed'];
    const idx = order.indexOf(item.status || 'Not Started');
    const next = order[(idx + 1) % order.length] as any;
    const updated = { ...item, status: next };
  const svc2 = await import('../../dal/clientWorkspace');
    await svc2.updateActionItem(orgId, updated);
    const list = await svc2.listActionItems(orgId);
    setActionItems(list);
  };

  const renderOverview = () => {
    if (profileLoading) {
      return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <LoadingSpinner text="Loading organization profile..." />
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

    const { organization, metrics, contacts = [], admins = [], invites = [], messages = [], assignments, lastContacted } = profile;
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

  const renderServices = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="font-bold text-lg mb-2">Services</h3>
      <p className="text-sm text-gray-600">List and configure services provided to this organization.</p>
      <div className="mt-4">
        <button className="px-4 py-2 bg-orange-500 text-white rounded-lg">Edit Services</button>
      </div>
    </div>
  );

  const renderResources = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">Resources</h3>
        <div className="flex items-center space-x-2">
          <button onClick={handleAssignDocument} className="px-3 py-1 bg-blue-600 text-white rounded-lg">Assign Demo Document</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-2">
          {documents.length === 0 ? (
            <div className="text-sm text-gray-500">No documents assigned to this organization.</div>
          ) : (
            <ul className="space-y-2">
              {documents.map(doc => (
                <li key={doc.id} className="p-3 border rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium">{doc.name}</div>
                    <div className="text-sm text-gray-600">{doc.filename || doc.category}</div>
                  </div>
                  <div className="text-sm text-gray-500">{doc.visibility}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border rounded-lg">
          <div className="text-sm font-medium mb-2">Upload & Assign</div>
          <input type="text" placeholder="Document name" value={docName} onChange={e => setDocName(e.target.value)} className="w-full mb-2 p-2 border rounded" />
          <input type="text" placeholder="Category" value={docCategory} onChange={e => setDocCategory(e.target.value)} className="w-full mb-2 p-2 border rounded" />
          <input type="text" placeholder="Tags (comma separated)" value={docTags} onChange={e => setDocTags(e.target.value)} className="w-full mb-2 p-2 border rounded" />
          <input type="file" onChange={e => handleFileChange(e.target.files?.[0] || null)} className="w-full mb-2" />
          <div className="text-right">
            <button onClick={handleUpload} className="px-3 py-1 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded">Upload & Share</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderActionTracker = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">Action Tracker</h3>
      </div>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input value={newActionTitle} onChange={e => setNewActionTitle(e.target.value)} placeholder="Action title" className="p-2 border rounded" />
        <input value={newActionDue} onChange={e => setNewActionDue(e.target.value)} placeholder="Due date" type="date" className="p-2 border rounded" />
        <input value={newActionAssignee} onChange={e => setNewActionAssignee(e.target.value)} placeholder="Assignee" className="p-2 border rounded" />
        <div className="md:col-span-3 text-right">
          <button onClick={handleAddAction} className="px-3 py-1 bg-blue-600 text-white rounded">Add Action</button>
        </div>
      </div>

      {actionItems.length === 0 ? (
        <div className="text-sm text-gray-500">No action items for this organization.</div>
      ) : (
        <ul className="space-y-2">
          {actionItems.map(item => (
            <li key={item.id} className="p-3 border rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-sm text-gray-600">Due: {item.dueDate || '—'}</div>
                <div className="text-xs text-gray-500">Assignee: {item.assignee || 'Unassigned'}</div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <div className={`px-2 py-1 rounded-full text-sm ${item.status === 'Completed' ? 'bg-green-100 text-green-800' : item.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{item.status}</div>
                <div className="flex space-x-2">
                  <button onClick={() => toggleActionStatus(item)} className="px-2 py-1 bg-white border rounded text-sm">Toggle Status</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderMetrics = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="font-bold text-lg mb-2">Metrics</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Documents</div>
          <div className="text-2xl font-bold">{documents.length}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Learners</div>
          <div className="text-2xl font-bold">{totalLearners === null ? '—' : totalLearners}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Action Items</div>
          <div className="text-2xl font-bold">{actionItems.length}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Completed</div>
          <div className="text-2xl font-bold">{
            actionItems.length === 0 ? '—' : `${Math.round((actionItems.filter(a => a.status === 'Completed').length / actionItems.length) * 100)}%`
          }</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Avg Completion</div>
          <div className="text-2xl font-bold">{avgCompletion === null ? '—' : `${avgCompletion}%`}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Strategic Plans</div>
          <div className="text-2xl font-bold">{strategicPlansCount}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">Downloads</div>
          <div className="text-2xl font-bold">{totalDownloads}</div>
        </div>
      </div>
    </div>
  );

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
        {activeTab === 'services' && renderServices()}
        {activeTab === 'resources' && renderResources()}
        {activeTab === 'action-tracker' && renderActionTracker()}
        {activeTab === 'metrics' && renderMetrics()}
      </div>
    </div>
  );
};

export default AdminOrganizationProfile;
