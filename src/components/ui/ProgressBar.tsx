import cn from '../../utils/cn';

export interface ProgressBarProps {
  value: number;
  className?: string;
  tone?: 'default' | 'success' | 'info';
  srLabel?: string;
}

const toneMap = {
  default: 'bg-sunrise',
  success: 'bg-forest',
  info: 'bg-skyblue',
};

const ProgressBar = ({
  value,
  className,
  tone = 'default',
  srLabel = 'Progress',
}: ProgressBarProps) => {
  const width = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('w-full rounded-full bg-mist/60 p-[3px]', className)}>
      <div
        role="progressbar"
        aria-label={srLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        className={cn(
          'h-2 rounded-full transition-all duration-300 ease-out',
          toneMap[tone],
          tone === 'default' && 'bg-gradient-to-r from-sunrise to-skyblue'
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
};

export default ProgressBar;
