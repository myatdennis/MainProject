import { type FC, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { WifiOff, LogIn } from 'lucide-react';
import Button from '../ui/Button';

interface ApiStatusBannerProps {
  apiReachable?: boolean | null;
  apiAuthRequired?: boolean | null;
  isAuthenticated?: boolean | null;
  surface: 'admin' | 'lms';
  lastCheckedAt?: string | number | Date | null;
  onRetry?: () => void;
  className?: string;
}

const formatTimestamp = (value?: string | number | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ApiStatusBanner: FC<ApiStatusBannerProps> = ({
  apiReachable = true,
  apiAuthRequired = false,
  isAuthenticated = true,
  surface,
  lastCheckedAt,
  onRetry,
  className = '',
}) => {
  const offline = apiReachable === false;
  const requiresAuth = !offline && Boolean(apiAuthRequired) && !isAuthenticated;
  const timestampLabel = useMemo(() => formatTimestamp(lastCheckedAt), [lastCheckedAt]);

  if (!offline && !requiresAuth) {
    return null;
  }
  const loginHref = surface === 'admin' ? '/admin/login' : '/lms/login';
  const surfaceLabel = surface === 'admin' ? 'Admin' : 'Learner';

  const title = offline ? 'API unreachable — offline mode' : 'Signed out — please log in';
  const description = offline
    ? `We cannot reach the API right now. Cached data may appear stale.${timestampLabel ? ` Last checked ${timestampLabel}.` : ''}`
    : 'Your session expired. Continue by signing back in to resume activity.';

  return (
    <div className={`border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`} data-testid="api-status-banner">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-amber-100 p-1 text-amber-600" aria-hidden>
            <WifiOff className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-amber-800">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {offline && onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} aria-label="Retry API health check">
              Retry
            </Button>
          )}
          {requiresAuth && (
            <Button asChild size="sm" variant="secondary">
              <Link to={loginHref} className="flex items-center gap-2">
                <LogIn className="h-4 w-4" aria-hidden />
                <span>Go to {surfaceLabel} login</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiStatusBanner;
