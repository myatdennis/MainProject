import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useContext, useState } from 'react';
import Toast from '../components/Toast';
const ToastContext = createContext(undefined);
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState({
        message: '',
        type: 'info',
        isVisible: false,
        duration: 3000
    });
    const showToast = (message, type = 'info', duration = 3000) => {
        setToast({
            message,
            type,
            isVisible: true,
            duration
        });
    };
    const hideToast = () => {
        setToast(prev => ({ ...prev, isVisible: false }));
    };
    return (_jsxs(ToastContext.Provider, { value: { showToast }, children: [children, _jsx("div", { className: "fixed top-4 right-4 z-50", children: _jsx(Toast, { message: toast.message, type: toast.type, isVisible: toast.isVisible, onClose: hideToast, duration: toast.duration }) })] }));
};
export default ToastContext;
