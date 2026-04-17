import { forwardRef, cloneElement, isValidElement } from 'react';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import cn from '../../utils/cn';
import LoadingSpinner from './LoadingSpinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'success' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  isFullWidth?: boolean;
  asChild?: boolean;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'text-[var(--cta-text)] [background-image:var(--cta-gradient)] bg-no-repeat bg-[length:100%_100%] shadow-[var(--cta-shadow)] hover:brightness-[0.98] focus-visible:ring-skyblue focus-visible:ring-offset-white',
  secondary:
    'bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-95 focus-visible:ring-skyblue focus-visible:ring-offset-white',
  outline:
    'border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] focus-visible:ring-skyblue focus-visible:ring-offset-white',
  ghost:
    'border border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-skyblue focus-visible:ring-offset-white',
  success:
    'bg-[var(--accent-success)] text-[var(--text-inverse)] hover:opacity-95 focus-visible:ring-skyblue focus-visible:ring-offset-white',
  danger:
    'bg-[var(--accent-danger)] text-[var(--text-inverse)] hover:opacity-95 focus-visible:ring-skyblue focus-visible:ring-offset-white',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      type = 'button',
      className,
      leadingIcon,
      trailingIcon,
      isFullWidth,
      disabled,
      loading = false,
      asChild,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 rounded-btn font-heading font-semibold leading-none transition-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';
    const isDisabled = disabled || loading;
    if (asChild && isValidElement(children)) {
      const child = children as ReactElement;

      return cloneElement(child, {
        className: cn(
          child.props.className,
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          isFullWidth && 'w-full',
          isDisabled && 'pointer-events-none opacity-60',
          className
        ),
        ref,
        'aria-busy': loading ? true : undefined,
        disabled: isDisabled,
        ...props,
      });
    }

    // Accessibility: enforce aria-label for icon-only buttons, add role, and ensure color contrast via design tokens
    const isIconOnly = !children && (leadingIcon || trailingIcon);
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          isFullWidth && 'w-full',
          className
        )}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        role="button"
        aria-label={isIconOnly && !props['aria-label'] ? 'Button' : props['aria-label']}
        tabIndex={0}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center">
            <LoadingSpinner size={size === 'lg' ? 'md' : 'sm'} color={variant === 'primary' ? 'white' : 'primary'} />
          </span>
        ) : (
          leadingIcon && <span className="inline-flex items-center">{leadingIcon}</span>
        )}
        <span className="whitespace-nowrap">{children}</span>
        {trailingIcon && <span className="inline-flex items-center">{trailingIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
