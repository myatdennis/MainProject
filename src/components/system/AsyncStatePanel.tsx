import { AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';

export type AsyncPanelState = 'loading' | 'error' | 'empty' | 'ready';

type AsyncStatePanelProps = {
  state: AsyncPanelState;
  loadingLabel?: string;
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  children?: ReactNode;
  className?: string;
};

const AsyncStatePanel = ({
  state,
  loadingLabel = 'Loading…',
  title,
  message,
  retryLabel = 'Retry',
  onRetry,
  secondaryActionLabel,
  onSecondaryAction,
  children,
  className = '',
}: AsyncStatePanelProps) => {
  if (state === 'ready') {
    return <>{children}</>;
  }

  if (state === 'loading') {
    return (
      <div className={`flex flex-col items-center justify-center gap-4 py-20 ${className}`} role="status" aria-live="polite">
        <LoadingSpinner size="lg" color="secondary" />
        <span className="text-lg text-slate-500">{loadingLabel}</span>
      </div>
    );
  }

  const isError = state === 'error';

  return (
    <Card tone="muted" className={`mt-6 text-center ${className}`} padding="lg" role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'}>
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${isError ? 'bg-red-50 text-red-600' : 'bg-cloud text-skyblue'}`}>
        {isError ? <AlertTriangle className="h-6 w-6" /> : <Inbox className="h-6 w-6" />}
      </div>
      {title ? <h3 className="mt-4 font-heading text-lg font-semibold text-charcoal">{title}</h3> : null}
      {message ? <p className="mt-2 text-sm text-slate/80">{message}</p> : null}
      {(onRetry || onSecondaryAction) && (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {onRetry ? (
            <Button size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {onSecondaryAction && secondaryActionLabel ? (
            <Button variant="ghost" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          ) : null}
        </div>
      )}
    </Card>
  );
};

export default AsyncStatePanel;
