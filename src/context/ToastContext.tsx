import React, { createContext, useContext, useState, ReactNode } from 'react';
import Toast, { ToastType } from '../components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    isVisible: boolean;
    duration?: number;
  }>({
    message: '',
    type: 'info',
    isVisible: false,
    duration: 3000
  });

  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
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

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50">
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={hideToast}
          duration={toast.duration}
        />
      </div>
    </ToastContext.Provider>
  );
};

export default ToastContext;
