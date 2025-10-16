import { FormEvent, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlarmClock,
  BarChart3,
  CalendarClock,
  Inbox,
  Laptop2,
  Megaphone,
  Send,
  Sparkles,
  Users2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { useNotificationCenter } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { findTemplateById, notificationTemplates } from '../../data/notificationTemplates';
import type { NotificationInput, NotificationRecord } from '../../types/notifications';

interface BroadcastFormState {
  templateId?: string;
  title: string;
  message: string;
  type: NotificationRecord['type'];
  category: NotificationRecord['category'];
  priority: NotificationRecord['priority'];
  actionLabel: string;
  link: string;
  recipientScope: 'all' | 'org' | 'user';
  recipientOrgId?: string;
  recipientUserId?: string;
  expiresAt?: string;
  scheduleAt?: string;
}

const defaultState: BroadcastFormState = {
  title: '',
  message: '',
  type: 'broadcast',
  category: 'announcement',
  priority: 'medium',
  actionLabel: 'View announcement',
  link: '',
  recipientScope: 'all',
};

const AdminBroadcastCenter = () => {
  const { create, notifications, analytics } = useNotificationCenter();
  const { user } = useAuth();
  const [form, setForm] = useState<BroadcastFormState>(defaultState);
  const [submitting, setSubmitting] = useState(false);

  const adminId = user?.id ?? 'admin-demo';

  const adminHistory = useMemo(
    () =>
      notifications
        .filter((note) => note.senderId === adminId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
    [notifications, adminId]
  );

  const handleTemplateSelect = (templateId: string) => {
    const template = findTemplateById(templateId);
    if (!template) return;
    setForm((prev) => ({
      ...prev,
      templateId,
      title: template.title ?? prev.title,
      message: template.message ?? prev.message,
      type: template.type ?? prev.type,
      category: template.category ?? prev.category,
      priority: template.priority ?? prev.priority,
      actionLabel: template.actionLabel ?? prev.actionLabel,
    }));
  };

  const handleChange = (key: keyof BroadcastFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const scheduleDate = form.scheduleAt ? new Date(form.scheduleAt) : undefined;
    const isScheduled = scheduleDate && scheduleDate.getTime() > Date.now();

    const payload: NotificationInput = {
      title: form.title,
      message: form.message,
      type: form.type,
      category: form.category,
      priority: form.priority,
      actionLabel: form.actionLabel,
      link: form.link || undefined,
      recipientOrgId: form.recipientScope === 'org' ? form.recipientOrgId ?? undefined : null,
      recipientUserId: form.recipientScope === 'user' ? form.recipientUserId ?? undefined : null,
      senderId: adminId,
      expiresAt: form.expiresAt || undefined,
      metadata: {
        templateId: form.templateId,
        scheduledFor: scheduleDate?.toISOString(),
        deliveryStatus: isScheduled ? 'scheduled' : 'sent',
      },
      isRead: false,
      createdAt: isScheduled ? scheduleDate?.toISOString() : undefined,
    };

    try {
      await create(payload);
      toast.success(isScheduled ? 'Broadcast scheduled successfully.' : 'Broadcast sent successfully.');
      setForm(defaultState);
    } catch (error) {
      console.error('Failed to send broadcast', error);
      toast.error('Unable to send broadcast notification.');
    } finally {
      setSubmitting(false);
    }
  };

  const preview: NotificationInput = {
    title: form.title || 'Broadcast preview',
    message: form.message || 'Compose a message to preview how learners will see it.',
    type: form.type,
    priority: form.priority,
    category: form.category,
    actionLabel: form.actionLabel,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 py-10">
      <header className="rounded-3xl bg-gradient-to-r from-[#3A7FFF] via-[#FF8895] to-[#D72638] p-[1px]">
        <div className="rounded-[calc(1.5rem-1px)] bg-white px-8 py-10 text-slate-900 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#D72638]/80">Messaging control center</p>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Broadcast announcements & in-app alerts
              </h1>
              <p className="max-w-2xl text-sm text-slate-600" style={{ fontFamily: 'Lato, sans-serif' }}>
                Deliver real-time course alerts, survey nudges, and system updates across the LMS. Schedule communications, reuse templates, and monitor engagement without leaving the admin workspace.
              </p>
            </div>
            <div className="rounded-2xl bg-[#3A7FFF]/10 px-6 py-4 text-sm text-[#3A7FFF]">
              <p className="font-semibold">Real-time status</p>
              <p>{analytics.unread} unread • {(analytics.openRate * 100).toFixed(0)}% open rate</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Compose broadcast
              </h2>
              <p className="text-sm text-slate-500">Send to the entire network, specific organizations, or individual learners.</p>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[#3A7FFF]" aria-hidden="true" />
              <span className="text-xs text-slate-500">Schedule optional for future delivery</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col space-y-1 text-sm font-medium text-slate-700">
              Title
              <input
                required
                value={form.title}
                onChange={(event) => handleChange('title', event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF]"
                placeholder="Inclusive leadership update"
              />
            </label>
            <label className="flex flex-col space-y-1 text-sm font-medium text-slate-700">
              Action label
              <input
                value={form.actionLabel}
                onChange={(event) => handleChange('actionLabel', event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF]"
                placeholder="View announcement"
              />
            </label>
          </div>

          <label className="flex flex-col space-y-1 text-sm font-medium text-slate-700">
            Message body
            <textarea
              required
              rows={5}
              value={form.message}
              onChange={(event) => handleChange('message', event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF]"
              placeholder="Share what’s new, why it matters, and the next action to take."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col space-y-1 text-sm font-medium text-slate-700">
              Notification type
              <select
                value={form.type}
                onChange={(event) => handleChange('type', event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF]"
              >
                <option value="broadcast">Broadcast announcement</option>
                <option value="assignment">Assignment alert</option>
                <option value="course_update">Course update</option>
                <option value="survey_reminder">Survey reminder</option>
                <option value="completion">Completion celebration</option>
                <option value="system">System update</option>
                <option value="message">Direct message</option>
              </select>
            </label>
            <label className="flex flex-col space-y-1 text-sm font-medium text-slate-700">
              Category
              <select
                value={form.category}
                onChange={(event) => handleChange('category', event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF]"
              >
                <option value="announcement">Announcement</option>
                <option value="alert">Alert</option>
                <option value="reminder">Reminder</option>
                <option value="celebration">Celebration</option>
                <option value="update">Update</option>
              </select>
            </label>
            <label className="flex flex-col space-y-1 text-sm font-medium text-slate-700">
              Priority
              <select
                value={form.priority}
                onChange={(event) => handleChange('priority', event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF]"
              >
                <option value="medium">Medium</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col space-y-1 text-sm font-medium text-slate-700">
              Action link
              <input
                value={form.link}
                onChange={(event) => handleChange('link', event.target.value)}
                placeholder="/client/course/123"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF]"
              />
            </label>
            <label className="flex flex-col space-y-1 text-sm font-medium text-slate-700">
              Expiration (optional)
              <input
                type="date"
                value={form.expiresAt ?? ''}
                onChange={(event) => handleChange('expiresAt', event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF]"
              />
            </label>
            <label className="flex flex-col space-y-1 text-sm font-medium text-slate-700">
              Schedule send
              <input
                type="datetime-local"
                value={form.scheduleAt ?? ''}
                onChange={(event) => handleChange('scheduleAt', event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF]"
              />
            </label>
          </div>

          <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recipients</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { value: 'all', label: 'All learners', icon: <Megaphone className="h-4 w-4" aria-hidden="true" /> },
                { value: 'org', label: 'Specific organization', icon: <Users2 className="h-4 w-4" aria-hidden="true" /> },
                { value: 'user', label: 'Individual user', icon: <Laptop2 className="h-4 w-4" aria-hidden="true" /> },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange('recipientScope', option.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition',
                    form.recipientScope === option.value
                      ? 'border-[#3A7FFF] bg-[#3A7FFF]/10 text-[#3A7FFF]'
                      : 'border-slate-200 text-slate-600 hover:border-[#3A7FFF] hover:text-[#3A7FFF]'
                  )}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
            {form.recipientScope === 'org' && (
              <input
                value={form.recipientOrgId ?? ''}
                onChange={(event) => handleChange('recipientOrgId', event.target.value)}
                placeholder="Organization ID"
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF]"
              />
            )}
            {form.recipientScope === 'user' && (
              <input
                value={form.recipientUserId ?? ''}
                onChange={(event) => handleChange('recipientUserId', event.target.value)}
                placeholder="User ID or email"
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[#3A7FFF] focus:outline-none focus:ring-2 focus:ring-[#3A7FFF]"
              />
            )}
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <AlarmClock className="h-4 w-4 text-[#3A7FFF]" aria-hidden="true" />
              <span>
                Scheduled send: {form.scheduleAt ? format(new Date(form.scheduleAt), 'PPpp') : 'Send immediately'}
              </span>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-[#D72638] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#b11f2d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {submitting ? 'Sending…' : 'Send broadcast'}
            </button>
          </div>
        </form>

        <aside className="space-y-6">
          <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Engagement overview
              </h2>
              <Users2 className="h-5 w-5 text-[#2D9B66]" aria-hidden="true" />
            </div>
            {analytics.engagementByOrg.length === 0 ? (
              <p className="text-sm text-slate-500">No organization-specific analytics yet. Send a targeted broadcast to see reach metrics.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {analytics.engagementByOrg.map((org) => (
                  <li key={org.orgId} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">Org {org.orgId}</span>
                      <span className="text-xs text-slate-400">{((org.read / Math.max(org.sent, 1)) * 100).toFixed(0)}% opened</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <span className="rounded-lg bg-[#3A7FFF]/10 px-2 py-1 font-semibold text-[#3A7FFF]">Sent {org.sent}</span>
                      <span className="rounded-lg bg-[#2D9B66]/10 px-2 py-1 font-semibold text-[#2D9B66]">Read {org.read}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Templates
            </h2>
            <p className="text-sm text-slate-500">Start from a proven message, then tailor it to your learners.</p>
            <div className="space-y-3">
              {notificationTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template.id)}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left transition hover:border-[#3A7FFF] hover:shadow-lg',
                    form.templateId === template.id ? 'border-[#3A7FFF] bg-[#3A7FFF]/10' : 'border-slate-200'
                  )}
                >
                  <p className="text-sm font-semibold text-slate-900">{template.title}</p>
                  <p className="text-xs text-slate-500">{template.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Preview
            </h2>
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#3A7FFF]/10 to-[#FF8895]/10 p-5">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-[#3A7FFF]" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide text-[#3A7FFF]">
                  {preview.category}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {preview.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600" style={{ fontFamily: 'Lato, sans-serif' }}>
                {preview.message}
              </p>
              <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#3A7FFF] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
                {preview.actionLabel || 'View details'}
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Recent broadcasts
              </h2>
              <BarChart3 className="h-5 w-5 text-[#3A7FFF]" aria-hidden="true" />
            </div>
            {adminHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                <Inbox className="h-8 w-8 text-slate-300" aria-hidden="true" />
                <p>No broadcasts yet.</p>
                <p className="text-xs">Compose a message to see analytics here.</p>
              </div>
            ) : (
              <ul className="space-y-3 text-sm">
                {adminHistory.map((note) => (
                  <li key={note.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{note.title}</p>
                      <span className="text-xs text-slate-400">{format(new Date(note.createdAt), 'PP')}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{note.message}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span>{note.priority.toUpperCase()}</span>
                      {note.recipientOrgId ? <span>Org: {note.recipientOrgId}</span> : <span>All users</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
};

export default AdminBroadcastCenter;
