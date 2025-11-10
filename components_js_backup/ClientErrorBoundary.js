import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home, MessageCircle, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
class ClientErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.retryTimeoutId = null;
        this.logErrorToService = async (error, errorInfo) => {
            try {
                const errorReport = {
                    error_id: this.state.errorId,
                    message: error.message,
                    stack: error.stack,
                    component_stack: errorInfo.componentStack,
                    user_agent: navigator.userAgent,
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                    retry_count: this.state.retryCount,
                    context: 'client_portal'
                };
                // Store in localStorage for later transmission
                const existingErrors = JSON.parse(localStorage.getItem('client_errors') || '[]');
                existingErrors.push(errorReport);
                // Keep only last 10 errors
                if (existingErrors.length > 10) {
                    existingErrors.splice(0, existingErrors.length - 10);
                }
                localStorage.setItem('client_errors', JSON.stringify(existingErrors));
                console.log('[ClientErrorBoundary] Error logged:', errorReport);
            }
            catch (loggingError) {
                console.error('[ClientErrorBoundary] Failed to log error:', loggingError);
            }
        };
        this.handleRetry = () => {
            const maxRetries = 3;
            if (this.state.retryCount >= maxRetries) {
                toast.error('Maximum retry attempts reached. Please refresh the page.', {
                    duration: 8000
                });
                return;
            }
            this.setState(prevState => ({
                retryCount: prevState.retryCount + 1
            }));
            toast.loading('Retrying...', { duration: 2000 });
            // Clear the error state after a short delay
            this.retryTimeoutId = setTimeout(() => {
                this.setState({
                    hasError: false,
                    error: null,
                    errorInfo: null
                });
                toast.success('Retrying your session', { duration: 2000 });
            }, 1000);
        };
        this.handleGoHome = () => {
            window.location.href = '/lms/dashboard';
        };
        this.handleRefreshPage = () => {
            window.location.reload();
        };
        this.handleContactSupport = () => {
            // Open support chat or email
            const supportEmail = 'support@example.com';
            const subject = encodeURIComponent(`Learning Session Error - ${this.state.errorId}`);
            const body = encodeURIComponent(`
      I encountered an error in my learning session.
      
      Error ID: ${this.state.errorId}
      Time: ${new Date().toLocaleString()}
      Page: ${window.location.href}
      
      Error Details:
      ${this.state.error?.message || 'Unknown error'}
      
      Please help me resolve this issue.
    `);
            window.open(`mailto:${supportEmail}?subject=${subject}&body=${body}`);
        };
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
            retryCount: 0
        };
    }
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
            errorId: `client_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
    }
    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        // Log error to console
        console.error('[ClientErrorBoundary] Error caught:', error);
        console.error('[ClientErrorBoundary] Error info:', errorInfo);
        // Call custom error handler
        this.props.onError?.(error, errorInfo);
        // Log to error service (in production)
        this.logErrorToService(error, errorInfo);
        // Show toast notification
        toast.error('Something went wrong with your learning session', {
            duration: 5000,
            id: 'client-error'
        });
    }
    componentWillUnmount() {
        if (this.retryTimeoutId) {
            clearTimeout(this.retryTimeoutId);
        }
    }
    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            const isNetworkError = this.state.error?.message?.includes('fetch') ||
                this.state.error?.message?.includes('network') ||
                !navigator.onLine;
            return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center", children: [_jsx("div", { className: "mx-auto mb-6 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center", children: isNetworkError ? (_jsx(WifiOff, { className: "w-8 h-8 text-red-600" })) : (_jsx(AlertTriangle, { className: "w-8 h-8 text-red-600" })) }), _jsx("h1", { className: "text-2xl font-bold text-gray-900 mb-4", children: isNetworkError ? 'Connection Lost' : 'Learning Session Interrupted' }), _jsx("p", { className: "text-gray-600 mb-6", children: isNetworkError
                                ? 'We lost connection to the learning platform. Please check your internet connection and try again.'
                                : 'Something unexpected happened during your learning session. Don\'t worry - your progress has been saved.' }), this.state.errorId && (_jsxs("div", { className: "bg-gray-50 rounded-lg p-3 mb-6", children: [_jsx("p", { className: "text-xs text-gray-500 mb-1", children: "Error Reference" }), _jsx("p", { className: "text-sm font-mono text-gray-700", children: this.state.errorId })] })), this.state.retryCount > 0 && (_jsx("div", { className: "mb-4", children: _jsxs("p", { className: "text-sm text-yellow-600", children: ["Retry attempts: ", this.state.retryCount, "/3"] }) })), _jsxs("div", { className: "space-y-3", children: [_jsxs("button", { onClick: this.handleRetry, disabled: this.state.retryCount >= 3, className: "w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2", children: [_jsx(RefreshCw, { className: "w-4 h-4" }), this.state.retryCount >= 3 ? 'Max Retries Reached' : 'Try Again'] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("button", { onClick: this.handleGoHome, className: "bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2", children: [_jsx(Home, { className: "w-4 h-4" }), "Dashboard"] }), _jsxs("button", { onClick: this.handleContactSupport, className: "bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2", children: [_jsx(MessageCircle, { className: "w-4 h-4" }), "Support"] })] }), _jsx("button", { onClick: this.handleRefreshPage, className: "w-full text-sm text-gray-500 hover:text-gray-700 py-2", children: "Refresh Page" })] }), isNetworkError && (_jsx("div", { className: "mt-6 p-3 bg-amber-50 rounded-lg border border-amber-200", children: _jsxs("p", { className: "text-sm text-amber-800", children: [_jsx(WifiOff, { className: "w-4 h-4 inline mr-1" }), navigator.onLine ? 'Connection unstable' : 'You are offline'] }) }))] }) }));
        }
        return this.props.children;
    }
}
export default ClientErrorBoundary;
