import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, MessageCircle, RefreshCw, Send } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import LoadingButton from '../LoadingButton';
import { listOrganizationMessages, sendOrganizationMessage } from '../../services/adminCommunicationService';
import type { OrgProfileMessage } from '../../services/orgService';

type OrgCommunicationPanelProps = {
  orgId: string;
  orgName?: string;
  messages?: OrgProfileMessage[];
  onMessageSent?: () => void;
};

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'in_app', label: 'In-app' },
];

const formatTimestamp = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const OrgCommunicationPanel: React.FC<OrgCommunicationPanelProps> = ({ orgId, orgName, messages = [], onMessageSent }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    subject: '',
    body: '',
    channel: 'email',
    recipients: '',
  });
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<OrgProfileMessage[]>(messages || []);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const recipientList = useMemo(() => {
    if (!form.recipients.trim()) return [];
    return form.recipients
      .split(/[\n,;]/)
      .map((value) => value.trim())
      .filter(Boolean);
  }, [form.recipients]);

  const hydrateMessages = useCallback(async () => {
    if (!orgId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await listOrganizationMessages(orgId);
      const rows = Array.isArray(response?.data) ? response.data : (response as OrgProfileMessage[]);
      setHistory(rows ?? []);
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      console.error('[OrgCommunicationPanel] Failed to refresh messages', error);
      setHistoryError('Unable to refresh messages right now.');
    } finally {
      setHistoryLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    setHistory(messages ?? []);
  }, [messages, orgId]);

  useEffect(() => {
    void hydrateMessages();
  }, [hydrateMessages]);

  const handleSend = useCallback(async () => {
    if (!form.body.trim()) {
      showToast?.('Message body is required.', 'error');
      return;
    }
    setSending(true);
    try {
      await sendOrganizationMessage(orgId, {
        subject: form.subject.trim() || undefined,
        body: form.body.trim(),
        channel: form.channel as 'email' | 'in_app',
        recipients: recipientList,
      });
      showToast?.('Message sent successfully.', 'success');
      setForm({ subject: '', body: '', channel: form.channel, recipients: '' });
      await hydrateMessages();
      onMessageSent?.();
    } catch (error) {
      console.error('Failed to send organization message', error);
      showToast?.('Unable to send message. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  }, [form.body, form.channel, form.subject, form.recipients, orgId, recipientList, hydrateMessages, onMessageSent, showToast]);

  const displayedMessages = history.length ? history : messages || [];

  const describeDirection = (message: OrgProfileMessage) => {
    const recipient = (message.recipientType || '').toLowerCase();
    if (recipient && recipient !== 'organization') {
      return 'Inbound';
    }
    if (!message.sentBy) {
      return 'Inbound';
    }
    return 'Sent';
  };

  return (
    <div className="card-lg card-hover space-y-6">
      <div className="flex flex-col gap-2 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Communication</p>
          <h2 className="text-2xl font-bold text-gray-900">Message {orgName ?? 'organization'}</h2>
          <p className="text-sm text-gray-600">Send announcements or reminders directly to the organization contacts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-orange-500" />
            <span>Messages logged automatically.</span>
          </div>
          <button
            type="button"
            onClick={() => void hydrateMessages()}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300 disabled:opacity-50"
            disabled={historyLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {lastSyncedAt && (
            <span className="text-[11px] text-gray-500">
              Synced {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              placeholder="Welcome aboard, onboarding update, reminder..."
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Message</label>
            <textarea
              rows={5}
              value={form.body}
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              placeholder="Share onboarding updates, reminders, or custom announcements."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Channel</label>
              <select
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                value={form.channel}
                onChange={(event) => setForm((prev) => ({ ...prev, channel: event.target.value }))}
              >
                {CHANNEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recipients (optional)</label>
              <input
                type="text"
                value={form.recipients}
                onChange={(event) => setForm((prev) => ({ ...prev, recipients: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                placeholder="Comma or newline separated emails"
              />
              <p className="mt-1 text-[11px] text-gray-500">Leave blank to use primary contacts on file.</p>
            </div>
          </div>
          <LoadingButton
            onClick={handleSend}
            loading={sending}
            className="w-full justify-center"
            leadingIcon={<Send className="h-4 w-4" />}
          >
            Send Message
          </LoadingButton>
        </div>

        <div className="min-h-[260px] rounded-2xl border border-gray-100 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-skyblue" />
              <p className="text-sm font-semibold text-gray-900">Recent messages</p>
            </div>
            <span className="text-xs text-gray-500">
              {displayedMessages.length} logged{historyLoading ? ' • syncing…' : ''}
            </span>
          </div>
          {historyError && <p className="mb-2 text-xs text-rose-500">{historyError}</p>}
          {historyLoading && displayedMessages.length === 0 ? (
            <p className="text-sm text-gray-500">Loading messages…</p>
          ) : displayedMessages.length === 0 ? (
            <p className="text-sm text-gray-500">No communication history yet.</p>
          ) : (
            <ul className="space-y-3">
              {displayedMessages.slice(0, 8).map((message) => {
                const direction = describeDirection(message);
                const directionStyles =
                  direction === 'Inbound'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-700';
                return (
                  <li key={message.id} className="rounded-xl border border-gray-100 px-3 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <p className="font-semibold text-gray-900">{message.subject || 'Untitled message'}</p>
                      <div className="flex items-center gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${directionStyles}`}>
                          {direction}
                        </span>
                        <span className="text-xs text-gray-500">{message.channel?.toUpperCase() ?? 'EMAIL'}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatTimestamp(message.sentAt)} • {message.status ?? 'sent'}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{message.body || '—'}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrgCommunicationPanel;
