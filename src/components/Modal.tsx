import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  ariaLabel?: string;
  theme?: 'light' | 'dark';
  closeOnOverlayClick?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'md', ariaLabel, closeOnOverlayClick = true }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleIdRef = useRef(`modal-title-${Math.random().toString(36).slice(2, 10)}`);
  const bodyIdRef = useRef(`modal-body-${Math.random().toString(36).slice(2, 10)}`);
  // Theme detection (fallback to light if not provided)
  const theme = typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      document.body.style.overflow = 'hidden';
      // Focus trap
      setTimeout(() => {
        modalRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = 'unset';
      previousFocusRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
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

  useEffect(() => {
    if (!isOpen) return;

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;

      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',');

      const focusableElements = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
        (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !modal.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !modal.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [isOpen]);

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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 z-50 overflow-y-auto ${theme === 'dark' ? 'dark' : ''}`}>
          <div className="modal-overlay" aria-hidden="true" onClick={closeOnOverlayClick ? onClose : undefined} />
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <motion.div
              ref={modalRef}
              className={`inline-block w-full ${getMaxWidthClass()} my-8 overflow-hidden text-left align-middle rounded-xl focus:outline-none modal-panel`}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              tabIndex={0}
              aria-label={ariaLabel || undefined}
              aria-labelledby={title ? titleIdRef.current : undefined}
              aria-describedby={bodyIdRef.current}
              aria-modal="true"
              role="dialog"
            >
              {title && (
                <div className="modal-header">
                  <h3 id={titleIdRef.current} className="text-xl font-heading m-0">{title}</h3>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`transition-colors focus:outline-none focus:ring-2 rounded-full modal-close`}
                    aria-label="Close modal"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              )}
              <div id={bodyIdRef.current} className={title ? 'p-8' : 'p-8'}>
                {children}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;