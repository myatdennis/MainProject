import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { CheckCircle, X, AlertCircle, Info } from 'lucide-react';
const Toast = ({ message, type, isVisible, onClose, duration = 3000 }) => {
    useEffect(() => {
        if (isVisible && duration > 0) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, duration, onClose]);
    if (!isVisible)
        return null;
    const getToastConfig = () => {
        switch (type) {
            case 'success':
                return {
                    bgColor: 'bg-green-50 border-green-200',
                    textColor: 'text-green-800',
                    icon: _jsx(CheckCircle, { className: "h-5 w-5 text-green-500" })
                };
            case 'error':
                return {
                    bgColor: 'bg-red-50 border-red-200',
                    textColor: 'text-red-800',
                    icon: _jsx(AlertCircle, { className: "h-5 w-5 text-red-500" })
                };
            case 'info':
            default:
                return {
                    bgColor: 'bg-blue-50 border-blue-200',
                    textColor: 'text-blue-800',
                    icon: _jsx(Info, { className: "h-5 w-5 text-blue-500" })
                };
        }
    };
    const config = getToastConfig();
    return (_jsx("div", { className: "fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300", children: _jsx("div", { className: `max-w-sm w-full ${config.bgColor} border border-l-4 rounded-lg p-4 shadow-lg`, children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex-shrink-0", children: config.icon }), _jsx("div", { className: "ml-3 flex-1", children: _jsx("p", { className: `text-sm font-medium ${config.textColor}`, children: message }) }), _jsx("div", { className: "ml-4 flex-shrink-0", children: _jsx("button", { onClick: onClose, className: `inline-flex rounded-md p-1.5 ${config.textColor} hover:bg-opacity-20 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500`, children: _jsx(X, { className: "h-4 w-4" }) }) })] }) }) }));
};
export default Toast;
