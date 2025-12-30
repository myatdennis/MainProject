import React, { useEffect } from 'react';
import { CheckCircle, X, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const toneConfig: Record<ToastType, { icon: React.ReactNode; title: string; tone: ToastType }> = {
  success: {
    icon: <CheckCircle className="h-5 w-5" aria-hidden="true" />,
    title: 'Success',
    tone: 'success',
  },
  error: {
    icon: <AlertCircle className="h-5 w-5" aria-hidden="true" />,
    title: 'Something went wrong',
    tone: 'error',
  },
  warning: {
    icon: <AlertCircle className="h-5 w-5" aria-hidden="true" />,
    title: 'Heads up',
    tone: 'warning',
  },
  info: {
    icon: <Info className="h-5 w-5" aria-hidden="true" />,
    title: 'FYI',
    tone: 'info',
  },
};

const Toast: React.FC<ToastProps> = ({ message, type, isVisible, onClose, duration = 3000 }) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const config = toneConfig[type] ?? toneConfig.info;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
      <div
        className="hud-toast"
        data-tone={config.tone}
        role="status"
        aria-live={type === 'error' ? 'assertive' : 'polite'}
      >
        <div className="hud-toast__icon">
          {config.icon}
        </div>
        <div className="hud-toast__body">
          <p className="hud-toast__title">{config.title}</p>
          <p className="hud-toast__message">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="hud-toast__close"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default Toast;