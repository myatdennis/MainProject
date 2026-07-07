import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import Toast, { ToastType } from '../components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
};

const MAX_VISIBLE_TOASTS = 4;

const createToastId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Stable across renders: components that depend on showToast in a
  // useCallback/useEffect dependency array (e.g. data-fetch retry logic)
  // would otherwise get a new reference on every toast, since setToasts
  // triggers a re-render here. That previously caused infinite fetch/toast
  // loops in callers whose effects depended on such a callback.
  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    setToasts((current) => {
      const nextToast: ToastItem = {
        id: createToastId(),
        message,
        type,
        duration,
      };
      const merged = [...current, nextToast];
      if (merged.length <= MAX_VISIBLE_TOASTS) {
        return merged;
      }
      return merged.slice(merged.length - MAX_VISIBLE_TOASTS);
    });
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(92vw,28rem)] flex-col gap-3" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            isVisible
            duration={toast.duration}
            className="pointer-events-auto"
            onClose={() => hideToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastContext;
