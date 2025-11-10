import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
const Modal = ({ isOpen, onClose, title, children, maxWidth = 'md', ariaLabel }) => {
    const modalRef = useRef(null);
    // Theme detection (fallback to light if not provided)
    const theme = typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Focus trap
            setTimeout(() => {
                modalRef.current?.focus();
            }, 100);
        }
        else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);
    // Framer Motion modal animation
    const modalVariants = {
        hidden: { opacity: 0, y: 40, transition: { duration: 0.2 } },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
        exit: { opacity: 0, y: 40, transition: { duration: 0.18 } }
    };
    const getMaxWidthClass = () => {
        switch (maxWidth) {
            case 'sm': return 'max-w-sm';
            case 'md': return 'max-w-md';
            case 'lg': return 'max-w-lg';
            case 'xl': return 'max-w-xl';
            case '2xl': return 'max-w-2xl';
            default: return 'max-w-md';
        }
    };
    return (_jsx(AnimatePresence, { children: isOpen && (_jsxs("div", { className: `fixed inset-0 z-50 overflow-y-auto ${theme === 'dark' ? 'dark' : ''}`, "aria-modal": "true", role: "dialog", tabIndex: -1, children: [_jsx("div", { className: "modal-overlay", "aria-hidden": "true" }), _jsx("div", { className: "flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0", children: _jsxs(motion.div, { ref: modalRef, className: `inline-block w-full ${getMaxWidthClass()} my-8 overflow-hidden text-left align-middle rounded-xl focus:outline-none modal-panel`, variants: modalVariants, initial: "hidden", animate: "visible", exit: "exit", tabIndex: 0, "aria-label": ariaLabel || title || 'Modal', children: [title && (_jsxs("div", { className: "modal-header", children: [_jsx("h3", { className: "text-xl font-heading m-0", children: title }), _jsx("button", { onClick: onClose, className: `transition-colors focus:outline-none focus:ring-2 rounded-full modal-close`, "aria-label": "Close modal", children: _jsx(X, { className: "h-6 w-6" }) })] })), _jsx("div", { className: title ? 'p-8' : 'p-8', children: children })] }) })] })) }));
};
export default Modal;
