import type { HTMLAttributes, ReactNode } from 'react';
import cn from '../../utils/cn';

type CardTone = 'default' | 'muted' | 'gradient';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  withBorder?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: ReactNode;
  footer?: ReactNode;
}

const paddingMap = {
  none: 'p-0',
  sm: 'p-5',
  md: 'p-6',
  lg: 'p-8',
};

const toneMap: Record<CardTone, string> = {
  default: 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-card border border-[var(--border-subtle)]',
  muted: 'bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-card-sm',
  gradient:
    'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-card border border-[var(--border-subtle)] bg-[linear-gradient(145deg,rgba(222,123,18,0.06),rgba(58,125,255,0.04),rgba(255,255,255,0.96))]',
};

export const Card = ({
  tone = 'default',
  withBorder = true,
  padding = 'md',
  header,
  footer,
  className,
  children,
  ...props
}: CardProps) => {
  return (
    <div
      className={cn(
        'rounded-2xl transition-shadow duration-200',
        toneMap[tone],
        withBorder ? '' : 'border-none',
        paddingMap[padding],
        className
      )}
      {...props}
    >
      {header && <div className="mb-5">{header}</div>}
      {children}
      {footer && <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">{footer}</div>}
    </div>
  );
};

export default Card;
