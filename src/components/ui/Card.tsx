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
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const toneMap: Record<CardTone, string> = {
  default: 'bg-white shadow-card border border-[rgba(31,41,51,0.08)]',
  muted: 'bg-cloud border border-mist shadow-card-sm',
  gradient: 'bg-white shadow-card border border-[rgba(31,41,51,0.08)] bg-[radial-gradient(circle_at_top,var(--color-soft-white)_0%,white_60%)]',
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
      {header && <div className="mb-4">{header}</div>}
      {children}
      {footer && <div className="mt-6 pt-4 border-t border-mist/60">{footer}</div>}
    </div>
  );
};

export default Card;
