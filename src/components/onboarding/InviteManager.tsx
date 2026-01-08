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
} from '../../services/onboardingService';

interface InviteRecord {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'sent' | 'accepted' | 'revoked' | 'expired' | 'bounced';
  inviterEmail?: string | null;
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

export interface InviteManagerProps {
  orgId: string;
  defaultRole?: string;
  onInvitesChanged?: (invites: InviteRecord[]) => void;
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

const InviteManager = ({ orgId, defaultRole = 'member', onInvitesChanged }: InviteManagerProps) => {
  const { showToast } = useToast();
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [singleRole, setSingleRole] = useState(defaultRole);
  const [bulkRole, setBulkRole] = useState(defaultRole);
  const [actionInviteId, setActionInviteId] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const response = await listOnboardingInvites(orgId);
      const next = (response?.data || []) as InviteRecord[];
      setInvites(next);
      onInvitesChanged?.(next);
    } catch (error) {
      console.error('[InviteManager] Failed to load invites', error);
      showToast('Unable to load invites.', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, onInvitesChanged, showToast]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const inviteCounts = useMemo(() => {
    return invites.reduce(
      (acc, invite) => {
        acc[invite.status] = (acc[invite.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [invites]);

  const handleCreateInvite = async () => {
    if (!singleEmail.trim()) {
      showToast('Enter an email to send an invite.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await createOnboardingInvite(orgId, { email: singleEmail.trim(), role: singleRole });
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
      const response = await bulkOnboardingInvites(orgId, entries);
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

  const handleResend = async (inviteId: string) => {
    setActionInviteId(inviteId);
    try {
      await resendOnboardingInvite(orgId, inviteId);
      showToast('Invite resent.', 'success');
      await loadInvites();
    } catch (error: any) {
      console.error('[InviteManager] Failed to resend invite', error);
      showToast(error?.message || 'Unable to resend invite', 'error');
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
      await revokeOnboardingInvite(orgId, inviteId);
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
                <th className="px-4 py-2 font-medium text-gray-700">Email</th>
                <th className="px-4 py-2 font-medium text-gray-700">Role</th>
                <th className="px-4 py-2 font-medium text-gray-700">Status</th>
                <th className="px-4 py-2 font-medium text-gray-700">Last Sent</th>
                <th className="px-4 py-2 font-medium text-gray-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} className="border-b border-gray-100">
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
                    {invite.lastSentAt ? new Date(invite.lastSentAt).toLocaleDateString() : '—'}
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
