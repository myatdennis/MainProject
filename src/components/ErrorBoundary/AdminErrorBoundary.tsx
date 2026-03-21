import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { getUserSession, secureGet, secureSet } from '../../lib/secureStorage';

interface Props {
  children: ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

type StoredErrorReport = {
  errorId: string;
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId: string;
};

const ADMIN_ERROR_BUFFER_KEY = 'admin_error_reports';

const resolveCurrentUserId = () => {
  try {
    return getUserSession()?.id ?? 'anonymous';
  } catch {
    return 'anonymous';
  }
};

const readStoredReports = (): StoredErrorReport[] => {
  try {
    return secureGet<StoredErrorReport[]>(ADMIN_ERROR_BUFFER_KEY) ?? [];
  } catch (error) {
    console.warn('[AdminErrorBoundary] Failed to read stored error reports:', error);
    return [];
  }
};

const persistStoredReports = (reports: StoredErrorReport[]) => {
  try {
    secureSet(ADMIN_ERROR_BUFFER_KEY, reports.slice(-10));
  } catch (error) {
    console.warn('[AdminErrorBoundary] Failed to persist error reports:', error);
  }
};

class AdminErrorBoundary extends Component<Props, State> {
  private retryTimeouts: Set<NodeJS.Timeout> = new Set();

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to monitoring service
    this.logErrorToService(error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    const errorReport: StoredErrorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
  componentStack: errorInfo.componentStack ?? undefined,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: resolveCurrentUserId(),
    };

    // In production, send to error monitoring service (e.g., Sentry, LogRocket)
    console.error('🚨 ADMIN PORTAL ERROR 🚨', errorReport);
    console.error('ERROR MESSAGE:', error.message);
    console.error('ERROR STACK:', error.stack);
    
    // Store locally for debugging
    const existingErrors = readStoredReports();
    existingErrors.push(errorReport);
    persistStoredReports(existingErrors);
  };

  private handleRetry = () => {
    // Clear error state after a brief delay to allow for smooth transition
    const timeout = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: ''
      });
      this.retryTimeouts.delete(timeout);
    }, 100);
    
    this.retryTimeouts.add(timeout);
  };

  private handleGoHome = () => {
    // Reset error state first, then navigate to the dashboard via the
    // History API with a popstate event so React Router picks up the change.
    // NOTE: With AdminErrorBoundary now keyed on location.pathname in
    // AdminLayout, this button effectively navigates to a new route and the
    // key change will automatically reset the boundary — no manual setState
    // required.  We still call handleRetry() defensively for boundaries that
    // are used without a key (e.g. outside AdminLayout).
    this.handleRetry();
    // Use history.pushState + popstate so we stay inside the SPA without
    // triggering a full-page reload (which would re-run the cold-start auth
    // bootstrap pipeline).  React Router v6 listens to popstate and will
    // re-render with the new pathname.
    window.history.pushState({}, '', '/admin/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      // Default error UI — contained within the page content area, not full-screen
      return (
        <div className="flex min-h-[40vh] items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-xl border border-red-100 shadow-md p-8">
            {/* Error Icon & Title */}
            <div className="text-center mb-6">
              <div className="mx-auto w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Something went wrong on this page
              </h1>
              <p className="text-gray-600 text-sm">
                An unexpected error occurred. The rest of the admin portal is still working.
              </p>
            </div>

            {/* Error Details (if enabled) */}
            {this.props.showDetails && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Bug className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-red-800 mb-2">
                      Error ID: {this.state.errorId}
                    </h3>
                    <p className="text-sm text-red-700 font-mono bg-red-100 p-2 rounded border">
                      {this.state.error.message}
                    </p>
                    {this.state.errorInfo && (
                      <details className="mt-2">
                        <summary className="text-sm font-medium text-red-800 cursor-pointer">
                          Component Stack
                        </summary>
                        <pre className="text-xs text-red-700 bg-red-100 p-2 rounded border mt-1 overflow-auto max-h-32">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </button>
            </div>

            {/* Contact Support */}
            <div className="mt-5 pt-5 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">
                Still having issues?{' '}
                <a 
                  href="mailto:support@huddleco.com?subject=Admin Portal Error&body=Error ID: ${this.state.errorId}"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Contact Support
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminErrorBoundary;