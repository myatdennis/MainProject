import type { CourseSyncTruth } from '../../pages/Admin/courseBuilder/syncTruth';

type CourseSyncTruthIndicatorProps = {
  syncTruth: CourseSyncTruth;
};

const CourseSyncTruthIndicator = ({ syncTruth }: CourseSyncTruthIndicatorProps) => {
  return (
    <div
      className="flex flex-col text-sm text-right"
      role="status"
      aria-live={syncTruth.state === 'failed' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className={`flex items-center justify-end ${syncTruth.tone}`}>
        <span className={`mr-2 h-2 w-2 rounded-full ${syncTruth.dot}`}></span>
        {syncTruth.label}
      </span>
      <span className="max-w-md text-xs text-gray-500">{syncTruth.detail}</span>
    </div>
  );
};

export default CourseSyncTruthIndicator;
