import type { HTMLAttributes } from 'react';
import cn from '../../utils/cn';

type BadgeTone = 'neutral' | 'positive' | 'attention' | 'danger' | 'info';

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'bg-cloud text-slate',
  positive: 'bg-forest/10 text-forest',
  attention: 'bg-gold/15 text-gold',
  danger: 'bg-deepred/10 text-deepred',
  info: 'bg-skyblue/12 text-skyblue',
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
        soft ? 'bg-cloud text-slate' : toneStyles[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
