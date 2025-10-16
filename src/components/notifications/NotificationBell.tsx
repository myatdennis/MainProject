import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Megaphone,
  GraduationCap,
  Sparkles,
  ClipboardList,
  ShieldAlert,
  Inbox,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useNotificationCenter } from '../../context/NotificationContext';
import type { NotificationRecord } from '../../types/notifications';

interface NotificationBellProps {
  maxPreview?: number;
  variant?: 'admin' | 'client';
  className?: string;
}

const categoryIcon = (notification: NotificationRecord) => {
  switch (notification.type) {
    case 'assignment':
      return <GraduationCap className="h-4 w-4 text-[#3A7FFF]" aria-hidden="true" />;
    case 'survey_reminder':
      return <ClipboardList className="h-4 w-4 text-[#2D9B66]" aria-hidden="true" />;
    case 'completion':
      return <Sparkles className="h-4 w-4 text-[#FF8895]" aria-hidden="true" />;
    case 'broadcast':
      return <Megaphone className="h-4 w-4 text-[#D72638]" aria-hidden="true" />;
    case 'system':
      return <ShieldAlert className="h-4 w-4 text-[#3A7FFF]" aria-hidden="true" />;
    default:
      return <Bell className="h-4 w-4 text-[#3A7FFF]" aria-hidden="true" />;
  }
};

const priorityChip = (notification: NotificationRecord) => {
  const base =
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide';

  switch (notification.priority) {
    case 'urgent':
      return <span className={`${base} bg-[#D72638]/10 text-[#D72638]`}>Urgent</span>;
    case 'high':
      return <span className={`${base} bg-[#FF8895]/20 text-[#D72638]`}>High</span>;
    case 'medium':
      return <span className={`${base} bg-[#3A7FFF]/10 text-[#3A7FFF]`}>Medium</span>;
    default:
      return <span className={`${base} bg-slate-200 text-slate-600`}>Info</span>;
  }
};

const formatRelativeTime = (isoDate: string) => {
  const created = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

const NotificationBell = ({
  maxPreview = 5,
  variant = 'client',
  className,
}: NotificationBellProps) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    recordClick,
    markAllAsRead,
  } = useNotificationCenter();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const latestNotifications = useMemo(
    () =>
      notifications
        .filter((item) => !item.archived)
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, maxPreview),
    [notifications, maxPreview]
  );

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAction = async (notification: NotificationRecord) => {
    await markAsRead(notification.id);
    recordClick(notification.id);
    setOpen(false);
  };

  const containerClasses = cn('relative', className);
  const badgeColor = variant === 'admin' ? '#D72638' : '#FF8895';

  return (
    <div className={containerClasses} ref={bellRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'relative rounded-full p-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          variant === 'admin'
            ? 'text-slate-600 hover:text-[#D72638] focus-visible:ring-[#D72638]'
            : 'text-slate-600 hover:text-[#3A7FFF] focus-visible:ring-[#3A7FFF]'
        )}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
      >
        <Bell className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-semibold text-white shadow-lg"
            style={{ backgroundColor: badgeColor }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <div
        className={cn(
          'absolute right-0 mt-3 w-96 max-w-sm origin-top-right transform rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-900',
          open
            ? 'scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0'
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Notification Center
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Stay in sync with assignments, surveys, and updates.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="text-xs font-semibold text-[#3A7FFF] transition-colors hover:text-[#2D9B66] focus:outline-none"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto px-2 py-3">
          {latestNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center space-y-3 rounded-xl bg-slate-50 px-6 py-8 text-center dark:bg-slate-800">
              <Inbox className="h-10 w-10 text-slate-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  You’re all caught up
                </p>
                <p className="text-xs text-slate-500">
                  New notifications will appear here in real time.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {latestNotifications.map((notification) => (
                <li
                  key={notification.id}
                  className={cn(
                    'rounded-xl border border-transparent bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3A7FFF]/30 hover:shadow-lg dark:bg-slate-800',
                    !notification.isRead && 'bg-[#3A7FFF]/5'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleAction(notification)}
                    className="flex w-full items-start justify-between text-left"
                  >
                    <div className="flex flex-1 items-start space-x-3">
                      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                        {categoryIcon(notification)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            {notification.title}
                          </p>
                          {priorityChip(notification)}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lato, sans-serif' }}>
                          {notification.message}
                        </p>
                        <div className="flex items-center space-x-3 text-xs text-slate-500">
                          <span className="inline-flex items-center space-x-1">
                            <Clock3 className="h-3 w-3" aria-hidden="true" />
                            <span>{formatRelativeTime(notification.createdAt)}</span>
                          </span>
                          {notification.link && (
                            <span className="inline-flex items-center space-x-1 text-[#3A7FFF]">
                              <ChevronRight className="h-3 w-3" aria-hidden="true" />
                              <span>Open</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!notification.isRead && (
                      <CheckCircle2 className="ml-3 h-5 w-5 flex-shrink-0 text-[#2D9B66]" aria-hidden="true" />
                    )}
                  </button>
                  {notification.link && (
                    <Link
                      to={notification.link}
                      onClick={() => handleAction(notification)}
                      className="mt-3 inline-flex items-center space-x-1 rounded-lg bg-[#3A7FFF]/10 px-3 py-1 text-xs font-semibold text-[#3A7FFF] transition-colors hover:bg-[#3A7FFF]/20"
                    >
                      <span>{notification.actionLabel ?? 'View details'}</span>
                      <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between rounded-b-2xl bg-slate-50 px-5 py-3 dark:bg-slate-800">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Megaphone className="h-4 w-4 text-[#FF8895]" aria-hidden="true" />
            <span>
              {unreadCount} unread • {notifications.length} total
            </span>
          </div>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-[#3A7FFF] transition-colors hover:text-[#2D9B66]"
          >
            View all
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotificationBell;
