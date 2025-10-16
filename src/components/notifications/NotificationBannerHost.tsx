import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useNotificationCenter } from '../../context/NotificationContext';
import type { NotificationRecord } from '../../types/notifications';

interface NotificationBannerHostProps {
  limit?: number;
  autoDismissMs?: number;
}

const shouldShowBanner = (notification: NotificationRecord) => {
  if (notification.archived) return false;
  if (notification.isRead && notification.priority !== 'urgent') return false;
  if (notification.expiresAt) {
    const expires = new Date(notification.expiresAt).getTime();
    if (expires < Date.now()) return false;
  }
  return notification.priority === 'high' || notification.priority === 'urgent' || notification.category === 'celebration';
};

const NotificationBannerHost = ({ limit = 2, autoDismissMs = 1000 * 12 }: NotificationBannerHostProps) => {
  const { notifications, markAsRead } = useNotificationCenter();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const banners = useMemo(
    () =>
      notifications
        .filter(shouldShowBanner)
        .filter((notification) => !dismissed[notification.id])
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, limit),
    [notifications, dismissed, limit]
  );

  useEffect(() => {
    if (banners.length === 0) return;
    const timers = banners.map((notification) =>
      setTimeout(() => {
        setDismissed((prev) => ({ ...prev, [notification.id]: true }));
        if (notification.priority !== 'urgent') {
          markAsRead(notification.id).catch(() => {});
        }
      }, autoDismissMs)
    );
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [banners, autoDismissMs, markAsRead]);

  if (banners.length === 0) return null;

  return (
    <div className="space-y-3 px-4 py-2">
      {banners.map((notification, index) => {
        const isCelebration = notification.category === 'celebration';
        const background = isCelebration ? 'bg-gradient-to-r from-[#FF8895] to-[#D72638]' : 'bg-gradient-to-r from-[#3A7FFF] to-[#2D9B66]';
        return (
          <div
            key={notification.id}
            className={cn(
              'relative overflow-hidden rounded-2xl text-white shadow-lg transition-all duration-300 ease-in-out',
              background,
              'focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-white'
            )}
            style={{
              animation: `banner-slide-in 0.3s ease-in-out`,
            }}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex flex-1 items-start gap-3">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  {isCelebration ? (
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-wide" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {notification.title}
                  </p>
                  <p className="text-sm" style={{ fontFamily: 'Lato, sans-serif' }}>
                    {notification.message}
                  </p>
                  {notification.link && (
                    <Link
                      to={notification.link}
                      onClick={() => markAsRead(notification.id)}
                      className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-white/30"
                    >
                      {notification.actionLabel ?? 'View details'}
                    </Link>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissed((prev) => ({ ...prev, [notification.id]: true }))}
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
                aria-label={`Dismiss notification ${notification.title}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
              <div
                className="h-full bg-white"
                style={{
                  animation: `banner-progress ${autoDismissMs}ms linear forwards`,
                  animationDelay: `${index * 50}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
      <style>
        {`@keyframes banner-slide-in {
            from { transform: translateY(-10px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes banner-progress {
            from { width: 100%; }
            to { width: 0%; }
          }`}
      </style>
    </div>
  );
};

export default NotificationBannerHost;
