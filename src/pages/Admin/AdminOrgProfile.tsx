import { useMemo, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, ClipboardList, Mail, RefreshCw, UserPlus, Users } from 'lucide-react';
import ProfileView from '../../components/ProfileView';
import LoadingButton from '../../components/LoadingButton';
import InviteManager from '../../components/onboarding/InviteManager';
import OrgCommunicationPanel from '../../components/Admin/OrgCommunicationPanel';
import useOnboardingProgress from '../../hooks/useOnboardingProgress';
import orgService, { type OrgProfileDetails } from '../../dal/orgs';
import { getOrganizationProfile, type BaseResource } from '../../dal/profile';

const formatDisplayDate = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return '—';
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...options,
    });
  } catch {
    return value;
  }
};

const AdminOrgProfile: React.FC = () => {
  const { orgProfileId } = useParams<{ orgProfileId: string }>();

  const orgId = useMemo(() => {
    if (!orgProfileId) return null;
    if (orgProfileId.startsWith('org-profile-')) {
      return orgProfileId.replace('org-profile-', '');
    }
    return orgProfileId;
  }, [orgProfileId]);

  const {
    loading: progressLoading,
    error: progressError,
    summary,
    steps,
    completionPercent,
    frictionAlerts,
    invites,
    refresh,
  } = useOnboardingProgress(orgId ?? undefined, {
    pollIntervalMs: 60000,
  });

  const inviteStats = useMemo(() => {
    const list = Array.isArray(invites) ? invites : [];
    const pending = list.filter((invite: any) => invite.status === 'pending' || invite.status === 'sent').length;
    const accepted = list.filter((invite: any) => invite.status === 'accepted').length;
    const stale = list.filter((invite: any) => invite.status === 'expired' || invite.status === 'bounced').length;
    return { pending, accepted, stale };
  }, [invites]);

  const [orgProfile, setOrgProfile] = useState<OrgProfileDetails | null>(null);
  const [orgProfileLoading, setOrgProfileLoading] = useState(false);
  const [orgProfileError, setOrgProfileError] = useState<string | null>(null);
  const [resourceSummary, setResourceSummary] = useState<{
    total: number;
    unread: number;
    completed: number;
    items: BaseResource[];
  } | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);

  const metrics = orgProfile?.metrics ?? null;
  const contacts = orgProfile?.contacts ?? [];
  const adminUsers = orgProfile?.admins ?? [];
  const messages = orgProfile?.messages ?? [];
  const invites = orgProfile?.invites ?? [];
  const users = orgProfile?.users ?? [];
  const assignments = orgProfile?.assignments;
  const primaryContact = contacts.find((contact) => contact.isPrimary) ?? contacts[0] ?? null;

  const fetchOrgProfile = useCallback(() => {
    if (!orgId) {
      setOrgProfile(null);
      return;
    }
    setOrgProfileLoading(true);
    orgService
      .getOrgProfileDetails(orgId)
      .then((data) => {
        setOrgProfile(data);
        setOrgProfileError(null);
      })
      .catch((error) => {
        console.error('Failed to load organization overview', error);
        setOrgProfile(null);
        setOrgProfileError('Unable to load organization overview');
      })
      .finally(() => setOrgProfileLoading(false));
  }, [orgId]);

  useEffect(() => {
    void fetchOrgProfile();
  }, [fetchOrgProfile]);

  useEffect(() => {
    if (!orgId) {
      setResourceSummary(null);
      setResourceError(null);
      return;
    }
    let active = true;
    setResourceLoading(true);
    getOrganizationProfile(orgId)
      .then((legacy) => {
        if (!active) return;
        const resources = legacy?.resources ?? [];
        const unread = resources.filter((resource) => (resource.status ?? 'unread') === 'unread').length;
        const completed = resources.filter((resource) => resource.status === 'completed').length;
        setResourceSummary({
          total: resources.length,
          unread,
          completed,
          items: resources.slice(0, 3),
        });
        setResourceError(null);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Failed to load organization resources', error);
        setResourceSummary(null);
        setResourceError('Unable to load shared resources.');
      })
      .finally(() => {
        if (active) {
          setResourceLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [orgId]);

  const inviteSummary = useMemo(() => {
    return invites.reduce(
      (acc, invite) => {
        const status = invite.status?.toLowerCase() || 'pending';
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [invites]);

  const recentUsers = useMemo(() => users.slice(0, 6), [users]);

  const focusSection = useCallback((id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const formatStatusLabel = (status?: string | null) => {
    if (!status) return 'unknown';
    return status.replace(/_/g, ' ');
  };

  const renderStatusBadgeClass = (status?: string | null) => {
    switch (String(status || '').toLowerCase()) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700';
      case 'trial':
        return 'bg-blue-100 text-blue-700';
      case 'suspended':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatAssignmentDue = (value?: string | null) => {
    if (!value) return 'Flexible timeline';
    try {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return 'Flexible timeline';
      return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Flexible timeline';
    }
  };

  const renderAssignmentBucket = (
    label: string,
    icon: ReactNode,
    bucket?: { assignmentCount?: number; dueSoonCount?: number; completedCount?: number; topAssignments?: Array<{ id: string; title: string | null; dueAt: string | null; status: string | null; updatedAt: string | null }> },
  ) => {
    const total = bucket?.assignmentCount ?? 0;
    const dueSoon = bucket?.dueSoonCount ?? 0;
    const completed = bucket?.completedCount ?? 0;
    const topItems = bucket?.topAssignments ?? [];
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800">
            {icon}
            <p className="text-sm font-semibold">{label}</p>
          </div>
          <span className="text-sm font-semibold text-gray-900">{total}</span>
        </div>
        <p className="text-xs text-gray-500">
          {dueSoon} due soon • {completed} completed
        </p>
        <div className="mt-3 space-y-2">
          {topItems.length === 0 ? (
            <p className="text-xs text-gray-500">No assignments logged yet.</p>
          ) : (
            topItems.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-100 px-3 py-2">
                <p className="text-sm font-semibold text-gray-900">{item.title || 'Untitled assignment'}</p>
                <p className="text-xs text-gray-500">
                  {item.status ?? 'assigned'} • {formatAssignmentDue(item.dueAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  if (!orgProfileId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Organization Profile ID Not Found</h3>
          <p className="text-gray-600 mb-4">Please select an organization to view their profile.</p>
          <Link 
            to="/admin/organizations" 
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            Back to Organizations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="mb-6">
        <Link 
          to="/admin/organizations" 
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Organizations
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {summary?.orgName || 'Organization Profile'}
            </h1>
            <p className="text-gray-600">
              Track onboarding progress, invites, and operational readiness.
            </p>
          </div>
          {orgId && (
            <LoadingButton onClick={refresh} loading={progressLoading} variant="secondary">
              <RefreshCw className="h-4 w-4" />
              Sync Progress
            </LoadingButton>
          )}
        </div>
        {orgId && (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to={`/admin/organizations/${orgId}`}
              className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition"
            >
              <ClipboardList className="h-4 w-4" />
              Open Workspace
            </Link>
            <button
              type="button"
              onClick={() => focusSection('team-section')}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 transition"
            >
              <Users className="h-4 w-4" />
              View Team
            </button>
            <button
              type="button"
              onClick={() => focusSection('invites-section')}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 transition"
            >
              <UserPlus className="h-4 w-4" />
              Manage Invites
            </button>
            <button
              type="button"
              onClick={() => focusSection('communication-section')}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 transition"
            >
              <Mail className="h-4 w-4" />
              Message Organization
            </button>
          </div>
        )}
      </div>
    </div>

      {orgProfileError && (
        <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <p className="font-semibold">Unable to load organization overview.</p>
            <p className="text-sm">{orgProfileError}</p>
          </div>
        </div>
      )}

      {progressError && (
        <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <p className="font-semibold">Unable to load onboarding progress.</p>
            <p className="text-sm">{progressError}. Try refreshing.</p>
          </div>
          <LoadingButton onClick={refresh} loading={progressLoading} variant="secondary" className="ml-auto">
            Retry
          </LoadingButton>
        </div>
      )}

      {orgId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card-lg card-hover">
            <p className="text-sm font-medium text-gray-600">Onboarding completion</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{completionPercent}%</p>
            <p className="text-sm text-gray-500 mt-1">
              {summary ? `${summary.completedSteps} of ${summary.totalSteps} steps complete` : 'Waiting for telemetry'}
            </p>
            <div className="mt-4 h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-pink-500"
                style={{ width: `${completionPercent}%` }}
              ></div>
            </div>
          </div>
          <div className="card-lg card-hover">
            <p className="text-sm font-medium text-gray-600">Invite status</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Pending / Sent</span>
                <span className="text-xl font-semibold text-gray-900">{inviteStats.pending}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Accepted</span>
                <span className="text-xl font-semibold text-emerald-600">{inviteStats.accepted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Stale / Bounced</span>
                <span className="text-xl font-semibold text-rose-600">{inviteStats.stale}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Last invite sent: {summary?.lastSentAt ? new Date(summary.lastSentAt).toLocaleString() : '—'}
            </p>
          </div>
          <div className="card-lg card-hover">
            <p className="text-sm font-medium text-gray-600">Friction alerts</p>
            <div className="mt-4 space-y-3">
              {frictionAlerts.length === 0 ? (
                <div className="flex items-center gap-3 text-sm text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  No blockers detected.
                </div>
              ) : (
                frictionAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 text-sm text-rose-700">
                    <AlertTriangle className="h-5 w-5 mt-0.5" />
                    <p>{alert.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {orgProfile && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="card-lg card-hover">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Organization snapshot</h3>
              {orgProfileLoading && <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />}
            </div>
            <dl className="space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Type</dt>
                <dd className="font-medium text-gray-900">{orgProfile.organization.type || '—'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Subscription</dt>
                <dd className="font-medium text-gray-900">{orgProfile.organization.subscription}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${renderStatusBadgeClass(orgProfile.organization.status)}`}>
                    {formatStatusLabel(orgProfile.organization.status)}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Total users</dt>
                <dd className="font-medium text-gray-900">{metrics?.totalUsers ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Active users</dt>
                <dd className="font-medium text-emerald-700">{metrics?.activeUsers ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Courses assigned</dt>
                <dd className="font-medium text-gray-900">{metrics?.coursesAssigned ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Surveys assigned</dt>
                <dd className="font-medium text-gray-900">{metrics?.surveysAssigned ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Primary contact</dt>
                <dd className="font-medium text-gray-900">
                  {primaryContact ? primaryContact.name || primaryContact.email : '—'}
                </dd>
              </div>
            </dl>
          </div>
          <div className="card-lg card-hover">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Strategic contacts</h3>
              <span className="text-sm text-gray-500">{contacts.length} total</span>
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-gray-500">No contacts captured for this organization.</p>
            ) : (
              <ul className="space-y-3">
                {contacts.slice(0, 4).map((contact) => (
                  <li key={contact.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{contact.name || 'Unnamed contact'}</p>
                      <p className="text-sm text-gray-500">{contact.email || 'No email'}</p>
                    </div>
                    {contact.isPrimary && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        Primary
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card-lg card-hover">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Communication history</h3>
              <span className="text-sm text-gray-500">
                {orgProfile.lastContacted
                  ? `Last contacted ${formatDisplayDate(orgProfile.lastContacted, { hour: undefined, minute: undefined })}`
                  : 'No outreach yet'}
              </span>
            </div>
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500">No messages recorded for this organization.</p>
            ) : (
              <ul className="space-y-3">
                {messages.slice(0, 4).map((message) => (
                  <li key={message.id} className="border border-gray-100 rounded-lg p-3">
                    <p className="font-medium text-gray-900">{message.subject || 'Untitled message'}</p>
                    <p className="text-xs text-gray-500">
                      {message.channel?.toUpperCase() ?? 'EMAIL'} •{' '}
                      {message.sentAt ? formatDisplayDate(message.sentAt) : 'Unknown date'}
                    </p>
                    <p className="text-sm text-gray-600 truncate">{message.body || '—'}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {assignments && (
        <div className="card-lg card-hover space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Assigned content</p>
              <h3 className="text-xl font-semibold text-gray-900">Courses & surveys in progress</h3>
            </div>
            <p className="text-xs text-gray-500">
              Updated {assignments.generatedAt ? formatDisplayDate(assignments.generatedAt, { hour: undefined, minute: undefined }) : 'moments ago'}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {renderAssignmentBucket(
              'Courses',
              <BookOpen className="h-4 w-4 text-orange-500" />,
              assignments.courses,
            )}
            {renderAssignmentBucket(
              'Surveys',
              <ClipboardList className="h-4 w-4 text-indigo-500" />,
              assignments.surveys,
            )}
          </div>
        </div>
      )}

      {orgId && (
        <div className="card-lg card-hover space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Shared resources</p>
              <h3 className="text-xl font-semibold text-gray-900">Documents & notes sent to this org</h3>
            </div>
            <div className="text-xs text-gray-500 flex flex-col sm:items-end">
              <span>Total: {resourceSummary?.total ?? 0}</span>
              <span>
                Unread: {resourceSummary?.unread ?? 0} • Completed: {resourceSummary?.completed ?? 0}
              </span>
            </div>
          </div>
          {resourceLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
            </div>
          ) : resourceSummary && resourceSummary.items.length > 0 ? (
            <ul className="space-y-3">
              {resourceSummary.items.map((resource) => (
                <li key={resource.id} className="rounded-xl border border-gray-100 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-semibold text-gray-900">{resource.title}</p>
                    <span className="text-xs capitalize text-gray-500">{resource.type}</span>
                  </div>
                  {resource.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{resource.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {resource.status ? resource.status.replace(/_/g, ' ') : 'unread'} •{' '}
                    {formatDisplayDate(resource.createdAt, { hour: undefined, minute: undefined })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              {resourceError ?? 'No resources have been shared with this organization yet.'}
            </p>
          )}
        </div>
      )}

      {orgProfile && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div id="team-section" className="card-lg card-hover space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Leadership & admins</h3>
                <p className="text-sm text-gray-600">Owners and admins with elevated access.</p>
              </div>
              <span className="text-sm text-gray-500">{adminUsers.length} listed</span>
            </div>
            {adminUsers.length === 0 ? (
              <p className="text-sm text-gray-500">No admin memberships detected.</p>
            ) : (
              <ul className="space-y-3">
                {adminUsers.slice(0, 5).map((admin) => (
                  <li
                    key={admin.membershipId ?? admin.userId ?? admin.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 p-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{admin.name || admin.email || 'Unnamed admin'}</p>
                      <p className="text-sm text-gray-500">{admin.email || '—'}</p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {admin.role || 'member'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Recent members</p>
              {recentUsers.length === 0 ? (
                <p className="text-sm text-gray-500">No members on file.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-left font-medium">Role</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-left font-medium">Last activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentUsers.map((user) => (
                        <tr key={user.membershipId ?? user.userId ?? user.id}>
                          <td className="px-3 py-2 font-medium text-gray-900">{user.name || user.email || 'Unknown'}</td>
                          <td className="px-3 py-2 text-gray-600">{formatStatusLabel(user.role)}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${renderStatusBadgeClass(user.status)}`}>
                              {formatStatusLabel(user.status)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {user.lastLoginAt ? formatDisplayDate(user.lastLoginAt) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div id="invites-section" className="card-lg card-hover space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Open invites</h3>
                <p className="text-sm text-gray-600">Monitor pending and accepted invites.</p>
              </div>
              <span className="text-sm text-gray-500">{invites.length} total</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-xs text-amber-700 uppercase font-semibold">Pending</p>
                <p className="text-2xl font-bold text-amber-800">{(inviteSummary.pending ?? 0) + (inviteSummary.sent ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700 uppercase font-semibold">Accepted</p>
                <p className="text-2xl font-bold text-emerald-800">{inviteSummary.accepted ?? 0}</p>
              </div>
              <div className="rounded-xl bg-gray-100 p-3">
                <p className="text-xs text-gray-600 uppercase font-semibold">Stale</p>
                <p className="text-2xl font-bold text-gray-800">
                  {(inviteSummary.expired ?? 0) + (inviteSummary.revoked ?? 0) + (inviteSummary.bounced ?? 0)}
                </p>
              </div>
            </div>
            {invites.length === 0 ? (
              <p className="text-sm text-gray-500">No invites have been issued.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-left font-medium">Role</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Last sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invites.slice(0, 6).map((invite) => (
                      <tr key={invite.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{invite.email}</td>
                        <td className="px-3 py-2 text-gray-600">{invite.role}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${renderStatusBadgeClass(invite.status)}`}>
                            {formatStatusLabel(invite.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {invite.lastSentAt ? formatDisplayDate(invite.lastSentAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}


      {orgId && (
        <div className="card-lg card-hover">
          <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Activation checklist</h2>
              <p className="text-sm text-gray-600">Monitor milestones to ensure the org is launch-ready.</p>
            </div>
            <LoadingButton onClick={refresh} loading={progressLoading} variant="secondary">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </LoadingButton>
          </div>
          <div className="space-y-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border border-gray-100 rounded-xl p-4"
              >
                <div>
                  <p className="text-base font-medium text-gray-900">{step.title}</p>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      step.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : step.status === 'in_progress'
                        ? 'bg-amber-100 text-amber-800'
                        : step.status === 'blocked'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {step.status.replace(/_/g, ' ')}
                  </span>
                  {step.completedAt && (
                    <p className="text-xs text-gray-500">
                      Completed {new Date(step.completedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {orgId && (
        <div id="invite-manager-section">
          <InviteManager orgId={orgId} onInvitesChanged={() => refresh()} />
        </div>
      )}

      {orgId && orgProfile && (
        <div id="communication-section">
          <OrgCommunicationPanel
            orgId={orgId}
            orgName={orgProfile.organization.name}
            messages={messages}
            onMessageSent={fetchOrgProfile}
          />
        </div>
      )}

      <ProfileView profileType="organization" profileId={orgProfileId} isAdmin={true} />
    </div>
  );
};

export default AdminOrgProfile;
