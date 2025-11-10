import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
import cn from '../../utils/cn';
export const Input = forwardRef(({ className, hasError, disabled, ...props }, ref) => {
    return (_jsx("input", { ref: ref, disabled: disabled, className: cn('w-full rounded-lg border border-mist bg-white px-4 py-3 text-[15px] text-charcoal shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite placeholder:text-slate/60', hasError && 'border-deepred/70 focus-visible:ring-deepred/60', disabled && 'cursor-not-allowed opacity-60', className), ...props }));
});
Input.displayName = 'Input';
export default Input;
