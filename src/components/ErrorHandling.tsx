import React from 'react';
import { AlertTriangle, X, CheckCircle, Info, AlertCircle } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationProps {
  type: NotificationType;
  title: string;
  message?: string;
  onClose?: () => void;
  className?: string;
  autoClose?: boolean;
  duration?: number;
}

const notificationStyles = {
  success: {
    container: 'bg-green-50 border-green-200 text-green-800',
    icon: CheckCircle,
    iconColor: 'text-green-600'
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: AlertTriangle,
    iconColor: 'text-red-600'
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    icon: AlertCircle,
    iconColor: 'text-yellow-600'
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: Info,
    iconColor: 'text-blue-600'
  }
};

export const Notification: React.FC<NotificationProps> = ({
  type,
  title,
  message,
  onClose,
  className = '',
  autoClose = false,
  duration = 5000
}) => {
  const style = notificationStyles[type];
  const IconComponent = style.icon;

  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  return (
    <div className={`rounded-lg border p-4 ${style.container} ${className}`} role="alert">
      <div className="flex items-start">
        <IconComponent className={`w-5 h-5 mt-0.5 mr-3 ${style.iconColor}`} />
        <div className="flex-1">
          <h3 className="font-medium">{title}</h3>
          {message && <p className="mt-1 text-sm opacity-90">{message}</p>}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-3 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback?: React.ComponentType<{ error: Error; retry: () => void }> }>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{ fallback?: React.ComponentType<{ error: Error; retry: () => void }> }>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 MAIN APP ERROR BOUNDARY TRIGGERED 🚨');
    console.error('ERROR MESSAGE:', error.message);
    console.error('ERROR STACK:', error.stack);
    console.error('COMPONENT STACK:', errorInfo.componentStack);
    console.error('Full error object:', error);
    console.error('Full errorInfo object:', errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.retry} />;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
            </p>
            <div className="space-y-2">
              <button
                onClick={this.retry}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Refresh Page
              </button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer">Error Details</summary>
                <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}