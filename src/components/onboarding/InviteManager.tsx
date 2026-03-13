import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, RefreshCw, Send, Upload, UserPlus, Users, XCircle } from 'lucide-react';
import LoadingButton from '../LoadingButton';
import { useToast } from '../../context/ToastContext';
import {
  bulkOnboardingInvites,
  createOnboardingInvite,
  listOnboardingInvites,
  resendOnboardingInvite,
  revokeOnboardingInvite,
} from '../../dal/onboarding';
import {
  bulkOrgInvites as bulkAdminOrgInvites,
  createOrgInvite as createAdminOrgInvite,
  listOrgInvites as listAdminOrgInvites,
  resendOrgInvite as resendAdminOrgInvite,
  remindOrgInvite as remindAdminOrgInvite,
  revokeOrgInvite as revokeAdminOrgInvite,
} from '../../services/orgService';

interface InviteRecord {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'sent' | 'accepted' | 'revoked' | 'expired' | 'bounced';
  inviterEmail?: string | null;
  note?: string | null;
  token?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastSentAt?: string | null;
  expiresAt?: string;
  reminderCount?: number;
}

const ROLE_OPTIONS = [
  { label: 'Owner', value: 'owner' },
  { label: 'Admin', value: 'admin' },
  { label: 'Manager', value: 'manager' },
  { label: 'Member', value: 'member' },
];

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  sent: 'bg-sky-100 text-sky-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  revoked: 'bg-gray-200 text-gray-600',
  expired: 'bg-gray-200 text-gray-600',
  bounced: 'bg-rose-100 text-rose-700',
};

const MS_IN_MINUTE = 60 * 1000;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;
const MS_IN_DAY = 24 * MS_IN_HOUR;
const EXPIRING_SOON_DAYS = 3;

const isSelectableInvite = (invite: InviteRecord) => invite.status === 'pending' || invite.status === 'sent';

const formatRelativeTime = (value?: string | null) => {
  if (!value) return '—';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '—';
  const diff = timestamp - Date.now();
  const abs = Math.abs(diff);

  if (abs >= MS_IN_DAY) {
    const days = Math.round(abs / MS_IN_DAY);
    const label = `${days} day${days === 1 ? '' : 's'}`;
    return diff >= 0 ? `in ${label}` : `${label} ago`;
  }
  if (abs >= MS_IN_HOUR) {
    const hours = Math.max(1, Math.round(abs / MS_IN_HOUR));
    const label = `${hours} hr${hours === 1 ? '' : 's'}`;
    return diff >= 0 ? `in ${label}` : `${label} ago`;
  }
  const minutes = Math.max(1, Math.round(abs / MS_IN_MINUTE));
  return diff >= 0 ? `in ${minutes} min` : `${minutes} min ago`;
};

const describeExpiry = (expiresAt?: string | null) => {
  if (!expiresAt) return 'No expiry on file';
  const timestamp = Date.parse(expiresAt);
  if (Number.isNaN(timestamp)) return '—';
  if (timestamp <= Date.now()) {
    return `Expired ${formatRelativeTime(expiresAt)}`;
  }
  return `Expires ${formatRelativeTime(expiresAt)}`;
};

const expiryTone = (expiresAt?: string | null, status?: string) => {
  if (status === 'accepted') return 'text-emerald-600';
  if (!expiresAt) return 'text-gray-600';
  const timestamp = Date.parse(expiresAt);
  if (Number.isNaN(timestamp)) return 'text-gray-600';
  if (timestamp <= Date.now()) return 'text-rose-600';
  const days = (timestamp - Date.now()) / MS_IN_DAY;
  if (days <= EXPIRING_SOON_DAYS) return 'text-amber-600';
  return 'text-gray-700';
};

const describeReminder = (invite: InviteRecord) => {
  const basis = invite.lastSentAt || invite.createdAt;
  if (!basis) return 'Never sent';
  return `Last sent ${formatRelativeTime(basis)}`;
};

export interface InviteManagerProps {
  orgId: string;
  defaultRole?: string;
  onInvitesChanged?: (invites: InviteRecord[]) => void;
  mode?: 'admin' | 'onboarding';
}

const normalizeBulkEntries = (text: string, fallbackRole: string) => {
  return text
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [email, roleCandidate] = entry.split(/\s|;/).filter(Boolean);
      return {
        email: email.toLowerCase(),
        role: (roleCandidate || fallbackRole || 'member').toLowerCase(),
      };
    })
    .filter((entry) => entry.email.includes('@'))
    .slice(0, 100);
};

type InviteApi = {
  list: (orgId: string) => Promise<{ data: any[] }>;
  create: (orgId: string, payload: Record<string, any>) => Promise<any>;
  bulk: (orgId: string, invites: Array<Record<string, any>>) => Promise<{ results: Array<Record<string, any>> }>;
  resend: (orgId: string, inviteId: string) => Promise<any>;
  revoke: (orgId: string, inviteId: string) => Promise<any>;
  remind?: (orgId: string, inviteId: string) => Promise<any>;
};

const InviteManager = ({ orgId, defaultRole = 'member', onInvitesChanged, mode = 'admin' }: InviteManagerProps) => {
  const { showToast } = useToast();
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bulkResending, setBulkResending] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [singleRole, setSingleRole] = useState(defaultRole);
  const [bulkRole, setBulkRole] = useState(defaultRole);
  const [actionInviteId, setActionInviteId] = useState<string | null>(null);
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([]);
  const apiMode = mode ?? 'admin';

  const inviteApi = useMemo<InviteApi>(() => {
    if (apiMode === 'onboarding') {
      return {
        list: listOnboardingInvites,
        create: createOnboardingInvite,
        bulk: bulkOnboardingInvites,
        resend: resendOnboardingInvite,
        revoke: revokeOnboardingInvite,
      };
    }
    return {
      list: listAdminOrgInvites,
      create: createAdminOrgInvite,
      bulk: bulkAdminOrgInvites,
      resend: resendAdminOrgInvite,
      revoke: revokeAdminOrgInvite,
      remind: remindAdminOrgInvite,
    };
  }, [apiMode]);

  const loadInvites = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const response = await inviteApi.list(orgId);
      const next = (response?.data || []) as InviteRecord[];
      setInvites(next);
      onInvitesChanged?.(next);
    } catch (error) {
      console.error('[InviteManager] Failed to load invites', error);
      showToast('Unable to load invites.', 'error');
    } finally {
      setLoading(false);
    }
  }, [inviteApi, orgId, onInvitesChanged, showToast]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  useEffect(() => {
    setSelectedInviteIds((prev) =>
      prev.filter((id) => invites.some((invite) => invite.id === id && isSelectableInvite(invite))),
    );
  }, [invites]);

  const inviteCounts = useMemo(() => {
    return invites.reduce(
      (acc, invite) => {
        acc[invite.status] = (acc[invite.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [invites]);

  const selectableInvites = useMemo(() => invites.filter(isSelectableInvite), [invites]);
  const hasSelection = selectedInviteIds.length > 0;

  const handleCreateInvite = async () => {
    if (!singleEmail.trim()) {
      showToast('Enter an email to send an invite.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await inviteApi.create(orgId, { email: singleEmail.trim(), role: singleRole });
      showToast('Invite sent successfully.', 'success');
      setSingleEmail('');
      await loadInvites();
    } catch (error: any) {
      console.error('[InviteManager] Failed to create invite', error);
      showToast(error?.message || 'Failed to create invite', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkInvites = async () => {
    const entries = normalizeBulkEntries(bulkText, bulkRole);
    if (!entries.length) {
      showToast('Provide at least one valid email in the bulk uploader.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const response = await inviteApi.bulk(orgId, entries);
      const results = response.results || [];
      const duplicates = results.filter((entry) => entry.duplicate).length;
      const failures = results.filter((entry) => entry.error).length;
      const successCount = results.length - duplicates - failures;
      const summaryParts = [] as string[];
      if (successCount > 0) summaryParts.push(`${successCount} invites sent`);
      if (duplicates > 0) summaryParts.push(`${duplicates} duplicate${duplicates === 1 ? '' : 's'}`);
      if (failures > 0) summaryParts.push(`${failures} failure${failures === 1 ? '' : 's'}`);
      showToast(summaryParts.join(', ') || 'Bulk upload processed.', failures ? 'warning' : 'success');
      setBulkText('');
      await loadInvites();
    } catch (error: any) {
      console.error('[InviteManager] Bulk invite failure', error);
      showToast(error?.message || 'Failed to process bulk invites', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleInviteSelection = (inviteId: string, checked: boolean) => {
    setSelectedInviteIds((prev) => {
      if (checked) {
        return prev.includes(inviteId) ? prev : [...prev, inviteId];
      }
      return prev.filter((id) => id !== inviteId);
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInviteIds(selectableInvites.map((invite) => invite.id));
      return;
    }
    setSelectedInviteIds([]);
  };

  const handleBulkResendSelected = async () => {
    if (!selectedInviteIds.length) {
      showToast('Select at least one pending invite.', 'error');
      return;
    }
    setBulkResending(true);
    let success = 0;
    let failures = 0;
    for (const inviteId of selectedInviteIds) {
      try {
        await inviteApi.resend(orgId, inviteId);
        success += 1;
      } catch (error) {
        console.error('[InviteManager] Bulk resend failure', error);
        failures += 1;
      }
    }
    const summary = [
      success ? `${success} resent` : null,
      failures ? `${failures} failed` : null,
    ]
      .filter(Boolean)
      .join(', ');
    showToast(summary || 'Bulk resend complete.', failures ? 'warning' : 'success');
    setSelectedInviteIds([]);
    setBulkResending(false);
    await loadInvites();
  };

  const handleResend = async (inviteId: string, options?: { reminder?: boolean }) => {
    setActionInviteId(inviteId);
    try {
      if (options?.reminder) {
        if (!inviteApi.remind) {
          showToast('Reminders are not available right now.', 'error');
          return;
        }
        await inviteApi.remind(orgId, inviteId);
        showToast('Reminder sent.', 'success');
      } else {
        await inviteApi.resend(orgId, inviteId);
        showToast('Invite resent.', 'success');
      }
      await loadInvites();
    } catch (error: any) {
      console.error('[InviteManager] Failed to resend invite', error);
      showToast(error?.message || 'Unable to send invite/reminder', 'error');
    } finally {
      setActionInviteId(null);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Revoke this invite?')) {
      return;
    }
    setActionInviteId(inviteId);
    try {
      await inviteApi.revoke(orgId, inviteId);
      showToast('Invite revoked.', 'success');
      await loadInvites();
    } catch (error: any) {
      console.error('[InviteManager] Failed to revoke invite', error);
      showToast(error?.message || 'Unable to revoke invite', 'error');
    } finally {
      setActionInviteId(null);
    }
  };

  const emptyState = invites.length === 0;

  return (
    <div className="card-lg card-hover">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            Invite Management
          </h3>
          <p className="text-sm text-gray-600">Send, resend, or revoke onboarding invitations.</p>
        </div>
        <LoadingButton onClick={loadInvites} loading={loading} variant="secondary">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </LoadingButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <div className="border border-gray-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <UserPlus className="h-4 w-4 text-gray-500" />
            Single Invite
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Email</label>
            <input
              type="email"
              value={singleEmail}
              onChange={(e) => setSingleEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Role</label>
            <select
              value={singleRole}
              onChange={(e) => setSingleRole(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          <LoadingButton onClick={handleCreateInvite} loading={submitting}>
            <Mail className="h-4 w-4" />
            Send Invite
          </LoadingButton>
        </div>

        <div className="border border-gray-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Upload className="h-4 w-4 text-gray-500" />
            Bulk Upload
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="one@example.com\ntwo@example.com,admin"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500">Default Role</label>
              <select
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <LoadingButton onClick={handleBulkInvites} loading={submitting} variant="secondary">
              <Send className="h-4 w-4" />
              Process List
            </LoadingButton>
          </div>
          <p className="text-xs text-gray-500">
            Tip: Provide `email role` on the same line to override the default role.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {Object.entries(inviteCounts).map(([status, count]) => (
          <div key={status} className="border border-gray-100 rounded-lg p-3 text-center">
            <div className="text-2xl font-semibold text-gray-900">{count}</div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{status}</div>
          </div>
        ))}
      </div>

      {selectableInvites.length > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-dashed border-gray-200 bg-white/60 p-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
          <div>
            {hasSelection ? (
              <span className="font-semibold text-gray-900">{selectedInviteIds.length}</span>
            ) : (
              '0'
            )}{' '}
            pending invite{selectableInvites.length === 1 ? '' : 's'} selected
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                checked={hasSelection && selectedInviteIds.length === selectableInvites.length}
                onChange={(event) => handleSelectAll(event.target.checked)}
              />
              Select all pending
            </label>
            <LoadingButton
              variant="secondary"
              onClick={handleBulkResendSelected}
              disabled={!hasSelection}
              loading={bulkResending}
            >
              <RefreshCw className="h-4 w-4" />
              Resend selected
            </LoadingButton>
          </div>
        </div>
      )}

      {emptyState ? (
        <div className="py-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl">
          <p className="font-medium">No invites yet</p>
          <p className="text-sm">Use the forms above to invite your client admins and teammates.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    checked={hasSelection && selectedInviteIds.length === selectableInvites.length && selectableInvites.length > 0}
                    onChange={(event) => handleSelectAll(event.target.checked)}
                    aria-label="Select all invites"
                    disabled={selectableInvites.length === 0}
                  />
                </th>
                <th className="px-4 py-2 font-medium text-gray-700">Email</th>
                <th className="px-4 py-2 font-medium text-gray-700">Role</th>
                <th className="px-4 py-2 font-medium text-gray-700">Status</th>
                <th className="px-4 py-2 font-medium text-gray-700">Delivery</th>
                <th className="px-4 py-2 font-medium text-gray-700">Expiry</th>
                <th className="px-4 py-2 font-medium text-gray-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} className="border-b border-gray-100">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      disabled={!isSelectableInvite(invite)}
                      checked={selectedInviteIds.includes(invite.id)}
                      onChange={(event) => toggleInviteSelection(invite.id, event.target.checked)}
                      aria-label={`Select invite for ${invite.email}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{invite.email}</div>
                    <div className="text-xs text-gray-500">
                      Invited {invite.createdAt ? new Date(invite.createdAt).toLocaleDateString() : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700">{invite.role}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusStyles[invite.status] || 'bg-gray-100 text-gray-700'}`}>
                      {invite.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="text-sm">{describeReminder(invite)}</div>
                    <div className="text-xs text-gray-500">
                      Reminders: {invite.reminderCount ?? 0}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-sm font-semibold ${expiryTone(invite.expiresAt, invite.status)}`}>
                      {describeExpiry(invite.expiresAt)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <LoadingButton
                        onClick={() => handleResend(invite.id)}
                        loading={actionInviteId === invite.id}
                        variant="secondary"
                        disabled={invite.status === 'accepted' || invite.status === 'revoked'}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Resend
                      </LoadingButton>
                      {invite.status !== 'accepted' && invite.status !== 'revoked' && (
                        <LoadingButton
                          onClick={() => handleResend(invite.id, { reminder: true })}
                          loading={actionInviteId === invite.id}
                          variant="ghost"
                          disabled={!inviteApi.remind}
                        >
                          <Mail className="h-4 w-4" />
                          Reminder
                        </LoadingButton>
                      )}
                      <LoadingButton
                        onClick={() => handleRevoke(invite.id)}
                        loading={actionInviteId === invite.id}
                        variant="secondary"
                        disabled={invite.status === 'accepted' || invite.status === 'revoked'}
                      >
                        <XCircle className="h-4 w-4" />
                        Revoke
                      </LoadingButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InviteManager;
