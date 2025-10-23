import { useCallback, useRef } from 'react';
import type { FC } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';

type RetryableExecutor = <T>(action: () => Promise<T>, options?: RetryableActionOptions<T>) => Promise<T>;

export interface RetryableActionOptions<T = unknown> {
  loadingMessage?: string;
  retryLoadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  retryLabel?: string;
  dismissLabel?: string;
  toastId?: string;
  onSuccess?: (result: T) => void;
  onError?: (error: unknown) => void;
}

interface PendingAction<T = unknown> {
  action: () => Promise<T>;
  options: RetryableActionOptions<T>;
}

interface RetryToastProps {
  message: string;
  retryLabel: string;
  dismissLabel: string;
  onRetry: () => void;
  onDismiss: () => void;
}

const RetryToast: FC<RetryToastProps> = ({ message, retryLabel, dismissLabel, onRetry, onDismiss }) => {
  return (
    <div
      role="alert"
      className="w-80 max-w-sm rounded-lg border border-red-100 bg-white p-4 shadow-lg ring-1 ring-black/5"
    >
      <div className="flex items-start">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500" aria-hidden="true" />
        <div className="ml-3 flex-1">
          <p className="text-sm font-semibold text-red-700">{message}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex flex-1 items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
            >
              {retryLabel}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center justify-center rounded-md bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-2"
            >
              {dismissLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const useRetryableAction = () => {
  const lastActionRef = useRef<PendingAction<unknown> | null>(null);

  const execute = useCallback(async <T,>(
    action: () => Promise<T>,
    options: RetryableActionOptions<T> = {}
  ): Promise<T> => {
    const {
      loadingMessage = 'Processing...',
      retryLoadingMessage = 'Retrying...',
      successMessage = 'Action completed successfully',
      errorMessage = 'Something went wrong. Please try again.',
      retryLabel = 'Retry',
      dismissLabel = 'Dismiss',
      toastId,
      onSuccess,
      onError
    } = options;

    lastActionRef.current = {
      action: action as () => Promise<unknown>,
      options: options as RetryableActionOptions<unknown>
    };

    let loadingToastId: string | undefined;
    if (loadingMessage) {
      loadingToastId = toast.loading(loadingMessage, { id: toastId });
    }

    try {
      const result = await action();

      if (loadingToastId) {
        toast.success(successMessage, { id: loadingToastId });
      } else if (successMessage) {
        toast.success(successMessage);
      }

      onSuccess?.(result);
      lastActionRef.current = null;
      return result;
    } catch (error) {
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }

      console.error('[RetryableAction] Action failed:', error);
      onError?.(error);

      const retryToastId = `retry-${Date.now()}`;
      const retryOptions: RetryableActionOptions<T> = {
        ...options,
        loadingMessage: retryLoadingMessage
      };
      toast.custom(
        () => (
          <RetryToast
            message={errorMessage}
            retryLabel={retryLabel}
            dismissLabel={dismissLabel}
            onRetry={() => {
              toast.dismiss(retryToastId);
              void execute(action, retryOptions);
            }}
            onDismiss={() => toast.dismiss(retryToastId)}
          />
        ),
        { id: retryToastId, duration: Infinity, position: 'top-right' }
      );

      throw error;
    }
  }, []);

  const retryLast = useCallback(() => {
    if (!lastActionRef.current) return;

    const { action, options } = lastActionRef.current;
    execute(action as () => Promise<unknown>, {
      ...options,
      loadingMessage: options.retryLoadingMessage ?? 'Retrying...'
    } as RetryableActionOptions<unknown>).catch(() => {
      // Errors are already handled within execute
    });
  }, [execute]);

  return { execute: execute as RetryableExecutor, retryLast };
};
