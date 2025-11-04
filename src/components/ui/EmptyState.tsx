import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  illustrationSrc?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action, illustrationSrc }) => {
  return (
    <div className="card-lg card-hover centered">
      {illustrationSrc && (
        <img src={illustrationSrc} alt="" aria-hidden className="mx-auto mb-4 h-24 w-24 object-contain" />
      )}
      <h3 className="h3">{title}</h3>
      {description && <p className="measure lead mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
