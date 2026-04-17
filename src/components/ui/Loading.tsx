import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

const Loading: React.FC<LoadingProps> = ({ size = 'md', text, className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <LoadingSpinner size={size} />
      {text && <p className="text-sm text-app-muted">{text}</p>}
    </div>
  );
};

export default Loading;
