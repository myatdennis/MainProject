import cn from '../../utils/cn';

export interface ProgressBarProps {
  value: number;
  className?: string;
  tone?: 'default' | 'success' | 'info';
  srLabel?: string;
}

const ProgressBar = ({
  value,
  className,
  tone = 'default',
  srLabel = 'Progress',
}: ProgressBarProps) => {
  const width = Math.max(0, Math.min(100, value));

  // Use design tokens for color/gradient per brand rules
  const trackClass = 'w-full rounded-full bg-mist/60 p-[3px]';
  const barBaseClass = 'h-2 rounded-full transition-all duration-300 ease-out';
  const barStyle: React.CSSProperties = { width: `${width}%` };

  if (tone === 'info') {
    // Info tone: brand blue
    barStyle.background = 'var(--hud-blue)';
  } else {
    // Default/success: Blue→Green gradient
    barStyle.backgroundImage = 'var(--gradient-blue-green)';
  }

  return (
    <div className={cn(trackClass, className)}>
      <div
        role="progressbar"
        aria-label={srLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        className={barBaseClass}
        style={barStyle}
      />
    </div>
  );
};

export default ProgressBar;
