import React from 'react';
import { AlertTriangle, X, Trash2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingButton from './LoadingButton';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  loading = false
}) => {
  // Framer Motion modal animation
  const modalVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
    exit: { opacity: 0, y: 40, transition: { duration: 0.14 } }
  };
  if (!isOpen) return null;

  const getTypeConfig = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <Trash2 className="h-6 w-6 text-red-600" />,
          bgColor: 'bg-red-100',
          buttonVariant: 'danger' as const
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="h-6 w-6 text-orange-600" />,
          bgColor: 'bg-orange-100',
          buttonVariant: 'warning' as const
        };
      case 'info':
        return {
          icon: <CheckCircle className="h-6 w-6 text-blue-600" />,
          bgColor: 'bg-blue-100',
          buttonVariant: 'primary' as const
        };
      default:
        return {
          icon: <AlertTriangle className="h-6 w-6 text-red-600" />,
          bgColor: 'bg-red-100',
          buttonVariant: 'danger' as const
        };
    }
  };

  const typeConfig = getTypeConfig();

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirmation action failed:', error);
    }
  };

  const headerBg = type === 'danger'
    ? 'rgba(229,62,62,0.12)'
    : type === 'warning'
    ? 'rgba(250,204,100,0.12)'
    : 'rgba(58,125,255,0.08)';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirmation-modal-title">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={onClose}
            aria-label="Close modal background"
          />
          <motion.div
            className="modal-panel"
            tabIndex={-1}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-label="Confirmation Modal"
          >
            {/* Header */}
            <div className="modal-header">
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <div className="icon-wrap" style={{background: headerBg}}>{typeConfig.icon}</div>
                <h2 id="confirmation-modal-title" style={{fontSize: 20, fontWeight: 800, color: 'var(--neutral-text)'}}>{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="modal-close"
                disabled={loading}
                aria-label="Close modal"
              >
                <X style={{width: 18, height: 18, color: 'var(--subtext-muted)'}} />
              </button>
            </div>
            {/* Content */}
            <div className="modal-content">
              <p>{message}</p>
            </div>
            {/* Actions */}
            <div className="modal-actions">
              <button
                onClick={onClose}
                className="" 
                disabled={loading}
                style={{padding: '8px 14px', color: 'var(--neutral-text)', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: 12, fontWeight: 700}}
              >
                {cancelText}
              </button>
              <LoadingButton
                onClick={handleConfirm}
                loading={loading}
                variant={typeConfig.buttonVariant}
              >
                {confirmText}
              </LoadingButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmationModal;
