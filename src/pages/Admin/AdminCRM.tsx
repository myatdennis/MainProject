import { useCallback, useEffect, useMemo, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Building2, Mail, RefreshCw, Users } from 'lucide-react';
import { getCrmActivity, getCrmSummary, sendBroadcastNotification, type CrmActivity, type CrmSummary } from '../../services/crmService';
import LoadingButton from '../../components/LoadingButton';
import { useToast } from '../../context/ToastContext';

const parseList = (value: string) =>
  value
    .split(/[\n,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const AdminCRM: React.FC = () => {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [activity, setActivity] = useState<CrmActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    channel: 'in_app',
    audience: 'all_active_orgs',
    organizationIds: '',
    userIds: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, activityData] = await Promise.all([getCrmSummary(), getCrmActivity()]);
      setSummary(summaryData);
      setActivity(activityData);
    } catch (err) {
      console.error('Failed to load CRM data', err);
      setError(err instanceof Error ? err.message : 'Unable to load CRM data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleBroadcast = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      showToast?.('Title and message are required.', 'error');
      return;
    }
    setSending(true);
    try {
      await sendBroadcastNotification({
        title: broadcastForm.title.trim(),
        message: broadcastForm.message.trim(),
        channel: broadcastForm.channel as 'email' | 'in_app' | 'both',
        audience: broadcastForm.audience as 'custom' | 'all_active_orgs' | 'all_active_users',
        organizationIds: parseList(broadcastForm.organizationIds),
        userIds: parseList(broadcastForm.userIds),
        allOrganizations: broadcastForm.audience === 'all_active_orgs',
        allUsers: broadcastForm.audience === 'all_active_users',
      });
      showToast?.('Announcement dispatched.', 'success');
      setBroadcastForm((prev) => ({
        ...prev,
        title: '',
        message: '',
        organizationIds: '',
        userIds: '',
      }));
      void loadData();
    } catch (err) {
      console.error('Broadcast failed', err);
      showToast?.('Unable to send announcement. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  const summaryCards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: 'Organizations',
        icon: Building2,
        value: summary.organizations.total,
        subtext: `${summary.organizations.active} active · ${summary.organizations.onboarding} onboarding`,
      },
      {
        label: 'Users',
        icon: Users,
        value: summary.users.total,
        subtext: `${summary.users.active} active · ${summary.users.recentActive} recent`,
      },
      {
        label: 'Assignments (30d)',
        icon: Activity,
        value: summary.assignments.coursesLast30d + summary.assignments.surveysLast30d,
        subtext: `${summary.assignments.coursesLast30d} courses · ${summary.assignments.surveysLast30d} surveys`,
      },
      {
        label: 'Comms (30d)',
        icon: Mail,
        value: summary.communication.messagesLast30d + summary.communication.notificationsLast30d,
        subtext: `${summary.communication.messagesLast30d} messages · ${summary.communication.notificationsLast30d} notifications`,
      },
    ];
  }, [summary]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-4 border-b border-gray-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Admin CRM</p>
          <h1 className="text-3xl font-bold text-gray-900">Customer relationships</h1>
          <p className="text-sm text-gray-600">
            Monitor organization engagement, assignments, and communications from one workspace.
          </p>
        </div>
        <LoadingButton onClick={loadData} loading={loading} variant="secondary" className="self-start">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </LoadingButton>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <p className="font-semibold">Unable to load CRM data.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent organizations</p>
              <h2 className="text-xl font-bold text-gray-900">Onboarding pipeline</h2>
            </div>
            <Link to="/admin/organizations" className="text-sm font-semibold text-orange-600 hover:text-orange-700">
              View all
            </Link>
          </div>
          {activity?.organizations?.length ? (
            <ul className="space-y-3">
              {activity.organizations.map((org) => (
                <li key={org.id} className="rounded-xl border border-gray-100 px-3 py-2">
                  <p className="font-semibold text-gray-900">{org.name}</p>
                  <p className="text-xs text-gray-500">
                    {org.status ?? 'active'} • {org.contactEmail ?? 'No contact'} •{' '}
                    {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : '—'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No organization activity logged.</p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent learners</p>
              <h2 className="text-xl font-bold text-gray-900">User momentum</h2>
            </div>
            <Link to="/admin/users" className="text-sm font-semibold text-orange-600 hover:text-orange-700">
              View users
            </Link>
          </div>
          {activity?.users?.length ? (
            <ul className="space-y-3">
              {activity.users.map((user) => (
                <li key={user.id} className="rounded-xl border border-gray-100 px-3 py-2">
                  <p className="font-semibold text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">
                    {user.email} • {user.role ?? 'member'} • Last login{' '}
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : '—'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No recent learner logins.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Communication history</p>
              <h2 className="text-xl font-bold text-gray-900">Messages & outreach</h2>
            </div>
            <Link to="/admin/organizations" className="text-sm font-semibold text-orange-600 hover:text-orange-700">
              Manage orgs
            </Link>
          </div>
          {activity?.messages?.length ? (
            <ul className="space-y-3">
              {activity.messages.map((message) => (
                <li key={message.id as string} className="rounded-xl border border-gray-100 px-3 py-2">
                  <p className="font-semibold text-gray-900">{(message.subject as string) || 'Untitled message'}</p>
                  <p className="text-xs text-gray-500">
                    {(message.channel as string)?.toUpperCase() ?? 'EMAIL'} •{' '}
                    {message.sent_at ? new Date(message.sent_at as string).toLocaleString() : 'Pending'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No recent outbound communication.</p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Alerts</p>
              <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
            </div>
            <Link to="/admin/dashboard" className="text-sm font-semibold text-orange-600 hover:text-orange-700">
              View dashboard
            </Link>
          </div>
          {activity?.notifications?.length ? (
            <ul className="space-y-3">
              {activity.notifications.map((notification) => (
                <li key={notification.id as string} className="rounded-xl border border-gray-100 px-3 py-2">
                  <p className="font-semibold text-gray-900">{notification.title as string}</p>
                  <p className="text-xs text-gray-500">
                    {(notification.channel as string)?.toUpperCase() ?? 'IN_APP'} •{' '}
                    {notification.created_at ? new Date(notification.created_at as string).toLocaleString() : '—'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              {summary?.communication?.unreadNotifications
                ? `${summary.communication.unreadNotifications} unread notifications`
                : 'No notification activity yet.'}
            </p>
          )}
        </div>
      </div>

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
              placeholder="System update, reminder..."
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Channel</label>
            <select
              value={broadcastForm.channel}
              onChange={(event) => setBroadcastForm((prev) => ({ ...prev, channel: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
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
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            placeholder="Share important updates, launch news, or reminders."
            required
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Audience</label>
            <select
              value={broadcastForm.audience}
              onChange={(event) => setBroadcastForm((prev) => ({ ...prev, audience: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              <option value="all_active_orgs">All active organizations</option>
              <option value="all_active_users">All active users</option>
              <option value="custom">Custom selection</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Organization IDs (optional)</label>
            <input
              type="text"
              value={broadcastForm.organizationIds}
              disabled={broadcastForm.audience !== 'custom'}
              onChange={(event) => setBroadcastForm((prev) => ({ ...prev, organizationIds: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none disabled:bg-gray-50"
              placeholder="Comma separated org IDs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">User IDs (optional)</label>
            <input
              type="text"
              value={broadcastForm.userIds}
              disabled={broadcastForm.audience !== 'custom'}
              onChange={(event) => setBroadcastForm((prev) => ({ ...prev, userIds: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none disabled:bg-gray-50"
              placeholder="Comma separated user IDs"
            />
          </div>
        </div>
        <LoadingButton
          type="submit"
          loading={sending}
          className="w-full justify-center"
          variant="primary"
        >
          Send announcement
        </LoadingButton>
      </form>
    </div>
  );
};

export default AdminCRM;
