import { forwardRef, cloneElement, isValidElement } from 'react';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import cn from '../../utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'success' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  isFullWidth?: boolean;
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-sunrise text-white hover:bg-sunrise/90 focus-visible:ring-skyblue focus-visible:ring-offset-softwhite',
  secondary:
    'bg-skyblue/10 text-skyblue hover:bg-skyblue/15 focus-visible:ring-skyblue focus-visible:ring-offset-softwhite',
  outline:
    'border border-mist text-charcoal hover:border-skyblue/60 hover:text-skyblue focus-visible:ring-skyblue focus-visible:ring-offset-softwhite',
  ghost:
    'text-skyblue hover:bg-skyblue/10 focus-visible:ring-skyblue focus-visible:ring-offset-softwhite',
  success:
    'bg-forest text-white hover:bg-forest/90 focus-visible:ring-forest focus-visible:ring-offset-softwhite',
  danger:
    'bg-deepred text-white hover:bg-deepred/90 focus-visible:ring-deepred focus-visible:ring-offset-softwhite',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
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
      asChild,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 font-heading font-semibold rounded-lg transition-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed';
    if (asChild && isValidElement(children)) {
      const child = children as ReactElement;

      return cloneElement(child, {
        className: cn(
          child.props.className,
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          isFullWidth && 'w-full',
          disabled && 'pointer-events-none opacity-60',
          className
        ),
        ref,
        ...props,
      });
    }

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
        disabled={disabled}
        {...props}
      >
        {leadingIcon && <span className="inline-flex items-center">{leadingIcon}</span>}
        <span className="whitespace-nowrap">{children}</span>
        {trailingIcon && <span className="inline-flex items-center">{trailingIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
