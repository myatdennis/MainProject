import { useCallback, useMemo, useState } from 'react';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import LoadingButton from '../LoadingButton';
import { sendOrganizationMessage } from '../../services/adminCommunicationService';
import type { OrgProfileMessage } from '../../services/orgService';
import { format } from 'date-fns';

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
    return format(new Date(value), 'MMM d, yyyy h:mm a');
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

  const recipientList = useMemo(() => {
    if (!form.recipients.trim()) return [];
    return form.recipients
      .split(/[\n,;]/)
      .map((value) => value.trim())
      .filter(Boolean);
  }, [form.recipients]);

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
      onMessageSent?.();
    } catch (error) {
      console.error('Failed to send organization message', error);
      showToast?.('Unable to send message. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  }, [form.body, form.channel, form.subject, form.recipients, orgId, recipientList, onMessageSent, showToast]);

  return (
    <div className="card-lg card-hover space-y-6">
      <div className="flex flex-col gap-2 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Communication</p>
          <h2 className="text-2xl font-bold text-gray-900">Message {orgName ?? 'organization'}</h2>
          <p className="text-sm text-gray-600">Send announcements or reminders directly to the organization contacts.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Mail className="h-4 w-4 text-orange-500" />
          Messages sent are logged automatically.
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
            <span className="text-xs text-gray-500">{messages.length} logged</span>
          </div>
          {messages.length === 0 ? (
            <p className="text-sm text-gray-500">No communication history yet.</p>
          ) : (
            <ul className="space-y-3">
              {messages.slice(0, 6).map((message) => (
                <li key={message.id} className="rounded-xl border border-gray-100 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-semibold text-gray-900">{message.subject || 'Untitled message'}</p>
                    <span className="text-xs text-gray-500">{message.channel?.toUpperCase() ?? 'EMAIL'}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatTimestamp(message.sentAt)} • {message.status ?? 'sent'}
                  </p>
                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">{message.body || '—'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrgCommunicationPanel;
