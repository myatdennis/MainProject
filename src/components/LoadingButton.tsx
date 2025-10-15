import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps {
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
  icon?: React.ComponentType<any>;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  type = 'button',
  title,
  icon: Icon
}) => {
  const handleClick = async () => {
    if (onClick && !disabled && !loading) {
      await onClick();
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 text-white disabled:from-gray-400 disabled:to-gray-500';
      case 'secondary':
        return 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:bg-gray-100 disabled:text-gray-400';
      case 'success':
        return 'bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-400';
      case 'danger':
        return 'bg-red-500 hover:bg-red-600 text-white disabled:bg-gray-400';
      case 'warning':
        return 'bg-orange-500 hover:bg-orange-600 text-white disabled:bg-gray-400';
      default:
        return 'bg-gradient-to-r from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 text-white disabled:from-gray-400 disabled:to-gray-500';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'md':
        return 'px-4 py-2 text-sm';
      case 'lg':
        return 'px-6 py-3 text-base';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  const baseClasses = 'font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2';
  const variantClasses = getVariantClasses();
  const sizeClasses = getSizeClasses();
  
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      title={title}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer transform hover:scale-105'} ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icon ? (
        <Icon className="h-4 w-4" />
      ) : null}
      <span>{children}</span>
    </button>
  );
};

export default LoadingButton;
