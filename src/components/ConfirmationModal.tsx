import React from 'react';
import { AlertTriangle, X, Trash2, CheckCircle } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${typeConfig.bgColor}`}>
              {typeConfig.icon}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-4 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
            disabled={loading}
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
      </div>
    </div>
  );
};

export default ConfirmationModal;
