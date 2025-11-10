import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Loader2 } from 'lucide-react';
export const LoadingSpinner = ({ size = 'md', className = '', text, ariaLive = 'polite' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };
    return (_jsx("div", { className: `flex items-center justify-center ${className}`, role: "status", "aria-live": ariaLive, children: _jsxs("div", { className: "flex flex-col items-center space-y-2", children: [_jsx(Loader2, { className: `animate-spin text-orange-500 ${sizeClasses[size]}`, "aria-label": "Loading", role: "progressbar" }), text && (_jsx("p", { className: "text-sm text-gray-600", children: text }))] }) }));
};
export const LoadingButton = ({ isLoading, children, className = '', disabled = false, onClick, type = 'button' }) => {
    return (_jsxs("button", { type: type, disabled: disabled || isLoading, onClick: onClick, className: `relative inline-flex items-center justify-center ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`, children: [isLoading && (_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" })), children] }));
};
export const Skeleton = ({ className = '', width = 'w-full', height = 'h-4' }) => {
    return (_jsx("div", { className: `animate-pulse bg-gray-200 rounded ${width} ${height} ${className}` }));
};
export const CourseCardSkeleton = () => {
    return (_jsxs("div", { className: "bg-white rounded-lg border border-gray-200 overflow-hidden", children: [_jsx(Skeleton, { className: "aspect-video", width: "w-full", height: "h-48" }), _jsxs("div", { className: "p-4 space-y-3", children: [_jsx(Skeleton, { width: "w-3/4", height: "h-5" }), _jsx(Skeleton, { width: "w-full", height: "h-4" }), _jsx(Skeleton, { width: "w-1/2", height: "h-4" }), _jsxs("div", { className: "flex justify-between", children: [_jsx(Skeleton, { width: "w-16", height: "h-4" }), _jsx(Skeleton, { width: "w-16", height: "h-4" })] }), _jsx(Skeleton, { width: "w-full", height: "h-10" })] })] }));
};
export default LoadingSpinner;
