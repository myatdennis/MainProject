import React from 'react';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'text' | 'avatar' | 'card' | 'block';
  width?: number | string;
  height?: number | string;
  rounded?: boolean;
};

const Skeleton: React.FC<SkeletonProps> = ({ variant = 'block', width, height, rounded, className, style, ...rest }) => {
  const classes = ['skeleton'];
  if (variant === 'text') classes.push('skeleton-text');
  if (variant === 'avatar') classes.push('skeleton-avatar');
  if (variant === 'card') classes.push('skeleton-card');
  if (rounded) classes.push('rounded-xl');

  const mergedStyle = { ...style } as React.CSSProperties;
  if (width) mergedStyle.width = width;
  if (height) mergedStyle.height = height;

  return <div className={[...classes, className ?? ''].join(' ').trim()} style={mergedStyle} {...rest} />;
};

export default Skeleton;
