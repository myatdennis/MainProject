import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Loader2, RefreshCcw, WifiOff } from 'lucide-react';
import {
  surveyQueueEvents,
  getQueueLength,
  getLastFlushTime,
  flushNow,
} from '../../dal/surveys';

interface SurveyQueueStatusProps {
  variant?: 'banner' | 'inline';
  className?: string;
  showFlushButton?: boolean;
  dataTestId?: string;
}

const formatTimestamp = (iso?: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const SurveyQueueStatus = ({
  variant = 'banner',
  className = '',
  showFlushButton = true,
  dataTestId,
}: SurveyQueueStatusProps) => {
  const [queueLength, setQueueLength] = useState(() => getQueueLength());
  const [lastFlushAt, setLastFlushAt] = useState(() => getLastFlushTime());
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [isFlushing, setIsFlushing] = useState(false);

  const refreshSnapshot = useCallback(() => {
    setQueueLength(getQueueLength());
    setLastFlushAt(getLastFlushTime());
  }, []);

  useEffect(() => {
    refreshSnapshot();
    surveyQueueEvents.addEventListener('queuechange', refreshSnapshot);
    surveyQueueEvents.addEventListener('flush', refreshSnapshot);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      surveyQueueEvents.removeEventListener('queuechange', refreshSnapshot);
      surveyQueueEvents.removeEventListener('flush', refreshSnapshot);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshSnapshot]);

  const state = useMemo(() => {
    if (!isOnline) {
      return {
        tone: 'warning',
        icon: WifiOff,
        label: 'Offline mode',
        detail:
          queueLength > 0
            ? `${queueLength} survey${queueLength === 1 ? '' : 's'} queued`
            : 'Changes will sync once back online',
        canFlush: false,
      } as const;
    }

    if (queueLength > 0 || isFlushing) {
      return {
        tone: 'pending',
        icon: Clock,
        label: isFlushing ? 'Syncing queued changes…' : 'Survey saves queued',
        detail: `${queueLength} pending ${queueLength === 1 ? 'survey' : 'surveys'}`,
        canFlush: queueLength > 0 && !isFlushing,
      } as const;
    }

    return {
      tone: 'ready',
      icon: CheckCircle2,
      label: 'All survey changes synced',
      detail: lastFlushAt ? `Last sync ${formatTimestamp(lastFlushAt)}` : 'Up to date',
      canFlush: false,
    } as const;
  }, [isOnline, isFlushing, queueLength, lastFlushAt]);

  const handleFlush = async () => {
    if (!state.canFlush || isFlushing) return;
    try {
      setIsFlushing(true);
      await flushNow();
    } catch (err) {
      console.warn('manual survey queue flush failed', err);
    } finally {
      setIsFlushing(false);
    }
  };

  const { icon: Icon } = state;
  const containerClasses =
    variant === 'banner'
      ? 'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm shadow-sm'
      : 'flex items-center gap-2 text-xs text-gray-600';

  const toneClasses = (() => {
    switch (state.tone) {
      case 'warning':
        return variant === 'banner'
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'text-amber-600';
      case 'pending':
        return variant === 'banner'
          ? 'border-sky-200 bg-sky-50 text-sky-900'
          : 'text-sky-600';
      case 'ready':
        return variant === 'banner'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'text-emerald-600';
      default:
        return '';
    }
  })();

  return (
    <div
      className={`${containerClasses} ${toneClasses} ${className}`}
      data-testid={dataTestId ?? 'survey-queue-status'}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${
            variant === 'banner' ? 'bg-white/80' : 'bg-transparent'
          }`}
        >
          <Icon
            className={`h-4 w-4 ${
              state.tone === 'warning'
                ? 'text-amber-500'
                : state.tone === 'pending'
                ? 'text-sky-600'
                : 'text-emerald-600'
            }`}
          />
        </div>
        <div>
          <p className={`font-semibold ${variant === 'banner' ? 'text-sm' : 'text-xs'}`}>
            {state.label}
          </p>
          {state.detail && (
            <p className={`text-xs ${variant === 'banner' ? 'text-gray-600' : 'text-gray-500'}`}>
              {state.detail}
            </p>
          )}
        </div>
      </div>
      {showFlushButton && state.canFlush && (
        <button
          type="button"
          onClick={handleFlush}
          className="inline-flex items-center gap-2 rounded-lg border border-sky-200 px-3 py-1 text-xs font-medium text-sky-700 transition hover:border-sky-300 hover:bg-white"
        >
          {isFlushing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" />
          )}
          <span>{isFlushing ? 'Flushing…' : 'Flush now'}</span>
        </button>
      )}
    </div>
  );
};

export default SurveyQueueStatus;
