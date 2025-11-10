import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { AlertTriangle, X, CheckCircle, Info, AlertCircle } from 'lucide-react';
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
export const Notification = ({ type, title, message, onClose, className = '', autoClose = false, duration = 5000 }) => {
    const style = notificationStyles[type];
    const IconComponent = style.icon;
    React.useEffect(() => {
        if (autoClose && onClose) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [autoClose, duration, onClose]);
    return (_jsx("div", { className: `rounded-lg border p-4 ${style.container} ${className}`, role: "alert", children: _jsxs("div", { className: "flex items-start", children: [_jsx(IconComponent, { className: `w-5 h-5 mt-0.5 mr-3 ${style.iconColor}` }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "font-medium", children: title }), message && _jsx("p", { className: "mt-1 text-sm opacity-90", children: message })] }), onClose && (_jsx("button", { onClick: onClose, className: "ml-3 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity", "aria-label": "Close notification", children: _jsx(X, { className: "w-4 h-4" }) }))] }) }));
};
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.retry = () => {
            this.setState({ hasError: false, error: undefined });
        };
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('🚨 MAIN APP ERROR BOUNDARY TRIGGERED 🚨');
        console.error('ERROR MESSAGE:', error.message);
        console.error('ERROR STACK:', error.stack);
        console.error('COMPONENT STACK:', errorInfo.componentStack);
        console.error('Full error object:', error);
        console.error('Full errorInfo object:', errorInfo);
        // Log to external service in production (if needed)
        if (import.meta.env.PROD) {
            try {
                // Could send to error tracking service here
                console.log('Production error logged');
            }
            catch (e) {
                // Ignore logging errors
            }
        }
    }
    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                const FallbackComponent = this.props.fallback;
                return _jsx(FallbackComponent, { error: this.state.error, retry: this.retry });
            }
            return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50", children: _jsxs("div", { className: "max-w-md w-full bg-white rounded-lg border border-gray-200 p-6 text-center", children: [_jsx(AlertTriangle, { className: "w-12 h-12 text-red-500 mx-auto mb-4" }), _jsx("h2", { className: "text-xl font-semibold text-gray-900 mb-2", children: "Something went wrong" }), _jsx("p", { className: "text-gray-600 mb-4", children: "We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists." }), _jsxs("div", { className: "space-y-2", children: [_jsx("button", { onClick: this.retry, className: "w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors", children: "Try Again" }), _jsx("button", { onClick: () => window.location.reload(), className: "w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors", children: "Refresh Page" })] }), this.state.error && (_jsxs("details", { className: "mt-4 text-left", children: [_jsx("summary", { className: "text-sm text-gray-500 cursor-pointer", children: "Error Details" }), _jsx("pre", { className: "mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-auto", children: this.state.error.message })] }))] }) }));
        }
        return this.props.children;
    }
}
