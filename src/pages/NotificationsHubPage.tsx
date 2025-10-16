import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  BellRing,
  CheckCircle2,
  Filter,
  Inbox,
  ListFilter,
  Loader2,
  MailOpen,
  Megaphone,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useNotificationCenter } from '../context/NotificationContext';
import type { NotificationRecord } from '../types/notifications';

const PAGE_SIZE = 10;

const formatRelativeTime = (iso: string) => {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const priorityColor = (notification: NotificationRecord) => {
  switch (notification.priority) {
    case 'urgent':
      return 'bg-[#D72638]/10 text-[#D72638]';
    case 'high':
      return 'bg-[#FF8895]/20 text-[#D72638]';
    case 'medium':
      return 'bg-[#3A7FFF]/15 text-[#3A7FFF]';
    default:
      return 'bg-slate-200 text-slate-700';
  }
};

const typeLabelMap: Record<NotificationRecord['type'], string> = {
  assignment: 'Assignment',
  broadcast: 'Broadcast',
  completion: 'Celebration',
  course_update: 'Course update',
  survey_reminder: 'Survey reminder',
  system: 'System update',
  message: 'Message',
};

const categoryColor = (category: NotificationRecord['category']) => {
  switch (category) {
    case 'alert':
      return 'bg-[#D72638]/15 text-[#D72638]';
    case 'announcement':
      return 'bg-[#3A7FFF]/15 text-[#3A7FFF]';
    case 'celebration':
      return 'bg-[#FF8895]/20 text-white';
    case 'reminder':
      return 'bg-[#2D9B66]/15 text-[#2D9B66]';
    case 'update':
    default:
      return 'bg-slate-200 text-slate-700';
  }
};

const NotificationsHubPage = () => {
  const {
    notifications,
    loading,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    archive,
    restore,
    remove,
    refresh,
    analytics,
  } = useNotificationCenter();

  const [typeFilter, setTypeFilter] = useState<'all' | NotificationRecord['type']>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | NotificationRecord['category']>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'priority'>('newest');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = notifications.filter((notification) =>
      showArchived ? notification.archived : !notification.archived
    );

    if (typeFilter !== 'all') {
      result = result.filter((notification) => notification.type === typeFilter);
    }
    if (categoryFilter !== 'all') {
      result = result.filter((notification) => notification.category === categoryFilter);
    }

    if (sortOption === 'priority') {
      const priorityOrder = ['urgent', 'high', 'medium', 'low'];
      result = [...result].sort(
        (a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
      );
    } else {
      result = [...result].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return sortOption === 'oldest' ? aTime - bTime : bTime - aTime;
      });
    }

    return result;
  }, [notifications, typeFilter, categoryFilter, showArchived, sortOption]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePageChange = (nextPage: number) => {
    setPage(Math.min(totalPages, Math.max(1, nextPage)));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3A7FFF]">Unified communications</p>
          <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Notification center
          </h1>
          <p className="text-sm text-slate-600" style={{ fontFamily: 'Lato, sans-serif' }}>
            Review announcements, assignments, and reminders in one feed. Everything syncs instantly across devices.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => refresh()}
            className="inline-flex items-center space-x-2 rounded-full border border-[#3A7FFF] px-4 py-2 text-sm font-semibold text-[#3A7FFF] transition hover:bg-[#3A7FFF] hover:text-white"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            <span>Refresh feed</span>
          </button>
          <button
            onClick={() => markAllAsRead()}
            className="inline-flex items-center space-x-2 rounded-full bg-[#2D9B66] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#238756]"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>Mark all read</span>
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500" style={{ fontFamily: 'Lato, sans-serif' }}>
            Total delivered
          </p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {analytics.total}
            </span>
            <BellRing className="h-6 w-6 text-[#3A7FFF]" aria-hidden="true" />
          </div>
          <p className="mt-1 text-xs text-slate-500">{analytics.unread} unread • {analytics.urgent} urgent</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500" style={{ fontFamily: 'Lato, sans-serif' }}>
            Open rate
          </p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {(analytics.openRate * 100).toFixed(0)}%
            </span>
            <MailOpen className="h-6 w-6 text-[#2D9B66]" aria-hidden="true" />
          </div>
          <p className="mt-1 text-xs text-slate-500">{analytics.read} viewed to date</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500" style={{ fontFamily: 'Lato, sans-serif' }}>
            Click engagement
          </p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {(analytics.clickRate * 100).toFixed(0)}%
            </span>
            <Megaphone className="h-6 w-6 text-[#FF8895]" aria-hidden="true" />
          </div>
          <p className="mt-1 text-xs text-slate-500">Tracked via in-app actions</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500" style={{ fontFamily: 'Lato, sans-serif' }}>
            Archived items
          </p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {analytics.archived}
            </span>
            <Archive className="h-6 w-6 text-slate-500" aria-hidden="true" />
          </div>
          <p className="mt-1 text-xs text-slate-500">Keep your feed organized by archiving completed items.</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center space-x-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
              <ListFilter className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value as typeof typeFilter);
                  setPage(1);
                }}
                className="bg-transparent text-sm text-slate-700 focus:outline-none"
              >
                <option value="all">All types</option>
                {Object.entries(typeLabelMap).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center space-x-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
              <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <select
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value as typeof categoryFilter);
                  setPage(1);
                }}
                className="bg-transparent text-sm text-slate-700 focus:outline-none"
              >
                <option value="all">All categories</option>
                <option value="alert">Alerts</option>
                <option value="announcement">Announcements</option>
                <option value="reminder">Reminders</option>
                <option value="celebration">Celebrations</option>
                <option value="update">Updates</option>
              </select>
            </label>
            <label className="flex items-center space-x-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
              <BellRing className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <select
                value={sortOption}
                onChange={(event) => {
                  setSortOption(event.target.value as typeof sortOption);
                  setPage(1);
                }}
                className="bg-transparent text-sm text-slate-700 focus:outline-none"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="priority">Priority</option>
              </select>
            </label>
          </div>
          <button
            onClick={() => {
              setShowArchived((prev) => !prev);
              setPage(1);
            }}
            className={cn(
              'inline-flex items-center space-x-2 rounded-full px-4 py-2 text-sm font-semibold transition',
              showArchived
                ? 'bg-slate-900 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-700 shadow-sm'
            )}
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
            <span>{showArchived ? 'Showing archived' : 'View archived'}</span>
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <span className="ml-2 text-sm">Loading notifications…</span>
            </div>
          ) : pageItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
              <Inbox className="h-10 w-10 text-slate-300" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-600">No notifications to show</p>
              <p className="text-xs text-slate-500">Adjust filters or check back later for new updates.</p>
            </div>
          ) : (
            pageItems.map((notification) => (
              <article
                key={notification.id}
                className={cn(
                  'flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#3A7FFF]/40 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center',
                  !notification.isRead && !notification.archived && 'bg-[#3A7FFF]/5'
                )}
              >
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide', categoryColor(notification.category))}>
                      {notification.category}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {typeLabelMap[notification.type]}
                    </span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide', priorityColor(notification))}>
                      {notification.priority}
                    </span>
                    {notification.recipientOrgId && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        Org: {notification.recipientOrgId}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {notification.title}
                  </h2>
                  <p className="text-sm text-slate-600" style={{ fontFamily: 'Lato, sans-serif' }}>
                    {notification.message}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#3A7FFF]" aria-hidden="true" />
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                    {notification.expiresAt && (
                      <span>Expires {new Date(notification.expiresAt).toLocaleDateString()}</span>
                    )}
                    {notification.link && (
                      <Link
                        to={notification.link}
                        onClick={() => markAsRead(notification.id)}
                        className="inline-flex items-center gap-1 text-[#3A7FFF] hover:text-[#2D9B66]"
                      >
                        Open destination
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:min-w-[12rem]">
                  {!notification.isRead ? (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2D9B66] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f8051]"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Mark read
                    </button>
                  ) : (
                    <button
                      onClick={() => markAsUnread(notification.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#3A7FFF] hover:text-[#3A7FFF]"
                    >
                      <MailOpen className="h-4 w-4" aria-hidden="true" />
                      Mark unread
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => (notification.archived ? restore(notification.id) : archive(notification.id))}
                      className={cn(
                        'flex-1 rounded-full px-4 py-2 text-sm font-semibold transition',
                        notification.archived
                          ? 'border border-slate-300 text-slate-600 hover:border-[#3A7FFF] hover:text-[#3A7FFF]'
                          : 'border border-slate-300 text-slate-600 hover:border-[#3A7FFF] hover:text-[#3A7FFF]'
                      )}
                    >
                      {notification.archived ? 'Restore' : 'Archive'}
                    </button>
                    <button
                      onClick={() => remove(notification.id)}
                      className="rounded-full border border-[#D72638]/40 px-3 py-2 text-sm text-[#D72638] transition hover:bg-[#D72638] hover:text-white"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {pageItems.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:border-[#3A7FFF] hover:text-[#3A7FFF] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:border-[#3A7FFF] hover:text-[#3A7FFF] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default NotificationsHubPage;
