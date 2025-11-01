import React, { PropsWithChildren } from 'react';

const PageWrapper: React.FC<PropsWithChildren<{className?: string}>> = ({ children, className }) => {
  return (
    <div className={`${className || ''} page-wrapper`}>
      <div className="page-inner">
        {children}
      </div>
    </div>
  );
};

export default PageWrapper;
