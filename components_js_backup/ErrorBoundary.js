import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught error:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { className: "min-h-screen page-wrapper", children: _jsxs("div", { className: "rounded-[var(--radius-card)] shadow-lg p-8 max-w-md w-full text-center gradient-card", children: [_jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "h-16 w-16 bg-accent-danger/10 rounded-full flex items-center justify-center mx-auto mb-4", children: _jsx("svg", { className: "h-8 w-8 text-accent-danger", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" }) }) }), _jsx("h2", { className: "text-2xl font-bold text-neutral-text", children: "Oops! Something went wrong" }), _jsx("p", { className: "muted-text", children: "We encountered an unexpected error. Please try refreshing the page." })] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-3 mb-6", children: [_jsxs("button", { onClick: () => window.location.reload(), className: "flex items-center justify-center space-x-2 bg-primary text-white px-4 py-2 rounded-[var(--radius-btn)] hover:bg-primary/90 transition-colors", children: [_jsx("svg", { className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" }) }), _jsx("span", { children: "Refresh Page" })] }), _jsxs("button", { onClick: () => window.location.href = '/', className: "flex items-center justify-center space-x-2 bg-background-light text-neutral-text px-4 py-2 rounded-[var(--radius-btn)] hover:bg-border-mist transition-colors", children: [_jsx("svg", { className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" }) }), _jsx("span", { children: "Go Home" })] })] }), process.env.NODE_ENV === 'development' && (_jsxs("details", { className: "text-left p-4 bg-red-50 border border-red-200 rounded-lg", children: [_jsx("summary", { className: "text-sm font-semibold text-red-800 cursor-pointer mb-2", children: "Development Error Details" }), _jsxs("pre", { className: "text-xs text-red-700 whitespace-pre-wrap break-words", children: [this.state.error?.message, this.state.error?.stack && (_jsx("div", { className: "mt-2 text-xs text-gray-600", children: this.state.error.stack }))] })] })), _jsx("div", { className: "mt-6 pt-4 border-t border-gray-100", children: _jsxs("p", { className: "text-xs text-gray-500", children: ["Error ID: ", Date.now().toString(36)] }) })] }) }));
        }
        return this.props.children;
    }
}
export default ErrorBoundary;
