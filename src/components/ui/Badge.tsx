import type { HTMLAttributes } from 'react';
import cn from '../../utils/cn';

type BadgeTone = 'neutral' | 'positive' | 'attention' | 'danger' | 'info';

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-text)]',
  positive: 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]',
  attention: 'bg-[var(--badge-warn-bg)] text-[var(--badge-warn-text)]',
  danger: 'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)]',
  info: 'bg-[var(--badge-info-bg)] text-[var(--badge-info-text)]',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  soft?: boolean;
}

export const Badge = ({ tone = 'neutral', soft = false, className, children, ...props }: BadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase',
        soft ? 'bg-[var(--surface-muted)] text-[var(--text-secondary)]' : toneStyles[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
