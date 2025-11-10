import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
class AdminErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.retryTimeouts = new Set();
        this.logErrorToService = (error, errorInfo) => {
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
            }
            catch (e) {
                console.error('Failed to store error locally:', e);
            }
        };
        this.handleRetry = () => {
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
        this.handleReload = () => {
            window.location.reload();
        };
        this.handleGoHome = () => {
            window.location.href = '/admin/dashboard';
        };
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: ''
        };
    }
    static getDerivedStateFromError(error) {
        const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return {
            hasError: true,
            error,
            errorId
        };
    }
    componentDidCatch(error, errorInfo) {
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
    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallbackComponent) {
                return this.props.fallbackComponent;
            }
            // Default error UI
            return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "max-w-2xl w-full bg-white rounded-xl shadow-xl p-8", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("div", { className: "mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4", children: _jsx(AlertTriangle, { className: "h-8 w-8 text-red-600" }) }), _jsx("h1", { className: "text-2xl font-bold text-gray-900 mb-2", children: "Something went wrong" }), _jsx("p", { className: "text-gray-600", children: "We encountered an unexpected error in the admin portal. Our team has been notified." })] }), this.props.showDetails && this.state.error && (_jsx("div", { className: "mb-6 p-4 bg-red-50 border border-red-200 rounded-lg", children: _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx(Bug, { className: "h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("h3", { className: "text-sm font-medium text-red-800 mb-2", children: ["Error ID: ", this.state.errorId] }), _jsx("p", { className: "text-sm text-red-700 font-mono bg-red-100 p-2 rounded border", children: this.state.error.message }), this.state.errorInfo && (_jsxs("details", { className: "mt-2", children: [_jsx("summary", { className: "text-sm font-medium text-red-800 cursor-pointer", children: "Component Stack" }), _jsx("pre", { className: "text-xs text-red-700 bg-red-100 p-2 rounded border mt-1 overflow-auto max-h-32", children: this.state.errorInfo.componentStack })] }))] })] }) })), _jsxs("div", { className: "flex flex-col sm:flex-row gap-3 justify-center", children: [_jsxs("button", { onClick: this.handleRetry, className: "flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium", children: [_jsx(RefreshCw, { className: "h-5 w-5 mr-2" }), "Try Again"] }), _jsxs("button", { onClick: this.handleGoHome, className: "flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium", children: [_jsx(Home, { className: "h-5 w-5 mr-2" }), "Go to Dashboard"] }), _jsxs("button", { onClick: this.handleReload, className: "flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium", children: [_jsx(RefreshCw, { className: "h-5 w-5 mr-2" }), "Reload Page"] })] }), _jsx("div", { className: "mt-6 pt-6 border-t border-gray-200 text-center", children: _jsxs("p", { className: "text-sm text-gray-600", children: ["Still having issues?", ' ', _jsx("a", { href: "mailto:support@huddleco.com?subject=Admin Portal Error&body=Error ID: ${this.state.errorId}", className: "text-blue-600 hover:text-blue-700 font-medium", children: "Contact Support" })] }) })] }) }));
        }
        return this.props.children;
    }
}
export default AdminErrorBoundary;
