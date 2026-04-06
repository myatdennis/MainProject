import React from 'react';
import { Inbox } from 'lucide-react';
import cn from '../../utils/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  illustrationSrc?: string;
  icon?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  illustrationSrc,
  icon,
  compact = false,
  className,
}) => {
  return (
    <section
      className={cn(
        'card-lg card-hover centered border border-mist/70 bg-white/90',
        compact ? 'p-6' : 'p-8',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {illustrationSrc && (
        <img src={illustrationSrc} alt="" aria-hidden className="mx-auto mb-4 h-24 w-24 object-contain" />
      )}
      {!illustrationSrc && (
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-cloud text-skyblue">
          {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
        </div>
      )}
      <h3 className="h3">{title}</h3>
      {description && <p className="measure lead mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
};

export default EmptyState;
