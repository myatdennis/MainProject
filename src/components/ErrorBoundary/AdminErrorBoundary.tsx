import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

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
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: localStorage.getItem('user_id') || 'anonymous'
    };

    // In production, send to error monitoring service (e.g., Sentry, LogRocket)
    console.error('🚨 ADMIN PORTAL ERROR 🚨', errorReport);
    console.error('ERROR MESSAGE:', error.message);
    console.error('ERROR STACK:', error.stack);
    
    // Store locally for debugging
    try {
      const existingErrors = JSON.parse(localStorage.getItem('admin_errors') || '[]');
      existingErrors.push(errorReport);
      // Keep only last 10 errors
      const recentErrors = existingErrors.slice(-10);
      localStorage.setItem('admin_errors', JSON.stringify(recentErrors));
    } catch (e) {
      console.error('Failed to store error locally:', e);
    }
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

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/admin/dashboard';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl p-8">
            {/* Error Icon & Title */}
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600">
                We encountered an unexpected error in the admin portal. Our team has been notified.
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
                className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Try Again
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                <Home className="h-5 w-5 mr-2" />
                Go to Dashboard
              </button>
              
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Reload Page
              </button>
            </div>

            {/* Contact Support */}
            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
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