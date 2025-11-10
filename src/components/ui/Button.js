import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, cloneElement, isValidElement } from 'react';
import cn from '../../utils/cn';
import LoadingSpinner from './LoadingSpinner';
const variantStyles = {
    primary: 'text-[var(--cta-text)] [background-image:var(--cta-gradient)] bg-no-repeat bg-[length:100%_100%] shadow-[var(--cta-shadow)] hover:opacity-95 focus-visible:ring-skyblue focus-visible:ring-offset-softwhite',
    secondary: 'bg-navy text-white hover:bg-navy/90 focus-visible:ring-skyblue focus-visible:ring-offset-softwhite',
    outline: 'border border-ink/30 text-ink hover:border-ink hover:bg-ink/5 focus-visible:ring-skyblue focus-visible:ring-offset-softwhite',
    ghost: 'text-ink border border-transparent hover:border-ink/20 hover:bg-ink/5 focus-visible:ring-skyblue focus-visible:ring-offset-softwhite',
    success: 'bg-forest text-white hover:bg-forest/90 focus-visible:ring-skyblue focus-visible:ring-offset-softwhite',
    danger: 'bg-deepred text-white hover:bg-deepred/90 focus-visible:ring-skyblue focus-visible:ring-offset-softwhite',
};
const sizeStyles = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-5 text-[15px]',
    lg: 'h-12 px-6 text-base',
};
export const Button = forwardRef(({ variant = 'primary', size = 'md', type = 'button', className, leadingIcon, trailingIcon, isFullWidth, disabled, loading = false, asChild, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-heading font-semibold rounded-btn transition-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed';
    const isDisabled = disabled || loading;
    if (asChild && isValidElement(children)) {
        const child = children;
        return cloneElement(child, {
            className: cn(child.props.className, baseStyles, variantStyles[variant], sizeStyles[size], isFullWidth && 'w-full', isDisabled && 'pointer-events-none opacity-60', className),
            ref,
            'aria-busy': loading ? true : undefined,
            disabled: isDisabled,
            ...props,
        });
    }
    return (_jsxs("button", { ref: ref, type: type, className: cn(baseStyles, variantStyles[variant], sizeStyles[size], isFullWidth && 'w-full', className), disabled: isDisabled, "aria-busy": loading || undefined, ...props, children: [loading ? (_jsx("span", { className: "inline-flex items-center", children: _jsx(LoadingSpinner, { size: size === 'lg' ? 'md' : 'sm', color: variant === 'primary' ? 'white' : 'primary' }) })) : (leadingIcon && _jsx("span", { className: "inline-flex items-center", children: leadingIcon })), _jsx("span", { className: "whitespace-nowrap", children: children }), trailingIcon && _jsx("span", { className: "inline-flex items-center", children: trailingIcon })] }));
});
Button.displayName = 'Button';
export default Button;
