import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertTriangle, X, Trash2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingButton from './LoadingButton';
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger', loading = false }) => {
    // Framer Motion modal animation
    const modalVariants = {
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
        exit: { opacity: 0, y: 40, transition: { duration: 0.14 } }
    };
    if (!isOpen)
        return null;
    const getTypeConfig = () => {
        switch (type) {
            case 'danger':
                return {
                    icon: _jsx(Trash2, { className: "h-6 w-6 text-red-600" }),
                    bgColor: 'bg-red-100',
                    buttonVariant: 'danger'
                };
            case 'warning':
                return {
                    icon: _jsx(AlertTriangle, { className: "h-6 w-6 text-orange-600" }),
                    bgColor: 'bg-orange-100',
                    buttonVariant: 'warning'
                };
            case 'info':
                return {
                    icon: _jsx(CheckCircle, { className: "h-6 w-6 text-blue-600" }),
                    bgColor: 'bg-blue-100',
                    buttonVariant: 'primary'
                };
            default:
                return {
                    icon: _jsx(AlertTriangle, { className: "h-6 w-6 text-red-600" }),
                    bgColor: 'bg-red-100',
                    buttonVariant: 'danger'
                };
        }
    };
    const typeConfig = getTypeConfig();
    const handleConfirm = async () => {
        try {
            await onConfirm();
        }
        catch (error) {
            console.error('Confirmation action failed:', error);
        }
    };
    const headerBg = type === 'danger'
        ? 'rgba(229,62,62,0.12)'
        : type === 'warning'
            ? 'rgba(250,204,100,0.12)'
            : 'rgba(58,125,255,0.08)';
    return (_jsx(AnimatePresence, { children: isOpen && (_jsxs("div", { className: "modal-overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": "confirmation-modal-title", children: [_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "modal-overlay", onClick: onClose, "aria-label": "Close modal background" }), _jsxs(motion.div, { className: "modal-panel", tabIndex: -1, variants: modalVariants, initial: "hidden", animate: "visible", exit: "exit", "aria-label": "Confirmation Modal", children: [_jsxs("div", { className: "modal-header", children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("div", { className: "icon-wrap", style: { background: headerBg }, children: typeConfig.icon }), _jsx("h2", { id: "confirmation-modal-title", style: { fontSize: 20, fontWeight: 800, color: 'var(--neutral-text)' }, children: title })] }), _jsx("button", { onClick: onClose, className: "modal-close", disabled: loading, "aria-label": "Close modal", children: _jsx(X, { style: { width: 18, height: 18, color: 'var(--subtext-muted)' } }) })] }), _jsx("div", { className: "modal-content", children: _jsx("p", { children: message }) }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { onClick: onClose, className: "", disabled: loading, style: { padding: '8px 14px', color: 'var(--neutral-text)', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: 12, fontWeight: 700 }, children: cancelText }), _jsx(LoadingButton, { onClick: handleConfirm, loading: loading, variant: typeConfig.buttonVariant, children: confirmText })] })] })] })) }));
};
export default ConfirmationModal;
