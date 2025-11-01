import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
  ariaLive?: 'off' | 'polite' | 'assertive';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '',
  text,
  ariaLive = 'polite'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`flex items-center justify-center ${className}`} role="status" aria-live={ariaLive}>
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className={`animate-spin text-orange-500 ${sizeClasses[size]}`} aria-label="Loading" role="progressbar" />
        {text && (
          <p className="text-sm text-gray-600">{text}</p>
        )}
      </div>
    </div>
  );
};

interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  children,
  className = '',
  disabled = false,
  onClick,
  type = 'button'
}) => {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center ${
        disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      {isLoading && (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      )}
      {children}
    </button>
  );
};

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '',
  width = 'w-full',
  height = 'h-4'
}) => {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${width} ${height} ${className}`} />
  );
};

export const CourseCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <Skeleton className="aspect-video" width="w-full" height="h-48" />
      <div className="p-4 space-y-3">
        <Skeleton width="w-3/4" height="h-5" />
        <Skeleton width="w-full" height="h-4" />
        <Skeleton width="w-1/2" height="h-4" />
        <div className="flex justify-between">
          <Skeleton width="w-16" height="h-4" />
          <Skeleton width="w-16" height="h-4" />
        </div>
        <Skeleton width="w-full" height="h-10" />
      </div>
    </div>
  );
};

export default LoadingSpinner;
