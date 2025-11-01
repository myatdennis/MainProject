import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import cn from '../../utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        disabled={disabled}
        className={cn(
          'w-full rounded-lg border border-mist bg-white px-4 py-3 text-[15px] text-charcoal shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite placeholder:text-slate/60',
          hasError && 'border-deepred/70 focus-visible:ring-deepred/60',
          disabled && 'cursor-not-allowed opacity-60',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export default Input;
