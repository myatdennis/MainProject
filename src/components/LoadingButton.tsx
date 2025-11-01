import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

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
        return {
          background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)',
          color: '#fff',
          boxShadow: 'var(--elevation-card)'
        };
      case 'secondary':
        return {
          background: 'transparent',
          color: 'var(--secondary)',
          border: '1px solid var(--secondary)'
        };
      case 'success':
        return {
          background: 'var(--accent-success)',
          color: '#fff',
          boxShadow: 'var(--elevation-card)'
        };
      case 'danger':
        return {
          background: 'var(--danger, #E6473A)',
          color: '#fff',
          boxShadow: 'var(--elevation-card)'
        };
      case 'warning':
        return {
          background: 'var(--subtext-muted)',
          color: '#fff',
          boxShadow: 'var(--elevation-card)'
        };
      default:
        return {
          background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)',
          color: '#fff',
          boxShadow: 'var(--elevation-card)'
        };
    }
  };

  

  const sizeStyles = () => {
    switch (size) {
      case 'sm':
        return { padding: '6px 10px', fontSize: 14 };
      case 'md':
        return { padding: '10px 14px', fontSize: 15 };
      case 'lg':
        return { padding: '14px 20px', fontSize: 16 };
      default:
        return { padding: '10px 14px', fontSize: 15 };
    }
  };

  const isDisabled = disabled || loading;
  const variantStyle = getVariantClasses();
  const sStyle = sizeStyles();

  return (
    <motion.button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={loading}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 'var(--radius-btn)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        border: variantStyle.border || 'none',
        background: variantStyle.background,
        color: variantStyle.color,
        boxShadow: variantStyle.boxShadow,
        padding: sStyle.padding,
        fontFamily: 'var(--font-heading)',
        fontWeight: 700,
        fontSize: sStyle.fontSize,
        transition: 'transform var(--motion-duration-base), box-shadow var(--motion-duration-base)'
      }}
      whileHover={!isDisabled && window.matchMedia('(prefers-reduced-motion: no-preference)').matches ? { scale: 1.03, boxShadow: 'var(--shadow-soft)' } : {}}
      whileTap={!isDisabled && window.matchMedia('(prefers-reduced-motion: no-preference)').matches ? { scale: 0.98 } : {}}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={className}
    >
        {loading ? (
          <Loader2 className="icon-16 animate-spin" role="progressbar" aria-label="Loading" />
        ) : Icon ? (
          <Icon className="icon-16" />
        ) : null}
      <span>{children}</span>
    </motion.button>
  );
};

export default LoadingButton;
