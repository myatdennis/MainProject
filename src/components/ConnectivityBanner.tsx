import { AlertTriangle, RefreshCcw } from 'lucide-react';
import useRuntimeStatus from '../hooks/useRuntimeStatus';
import { refreshRuntimeStatus } from '../state/runtimeStatus';

const ConnectivityBanner = () => {
  const rts = useRuntimeStatus();

  // Derive the same status shape that the old useConnectivityCheck provided,
  // sourced from the shared runtimeStatus singleton (no extra /api/health poll).
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const status = !isOnline
    ? 'offline'
    : !rts.apiReachable
    ? 'server-unreachable'
    : !rts.apiHealthy
    ? 'api-error'
    : 'healthy';

  if (status === 'healthy') return null;

  const statusCopy: Record<string, string> = {
    offline: 'You appear to be offline. Changes will be saved locally until your connection returns.',
    'server-unreachable': 'We cannot reach the API server. Please check that npm run dev is running.',
    'api-error': 'The API health check failed. Review server logs or retry shortly.',
  };

  const handleRetry = () => {
    refreshRuntimeStatus().catch(() => undefined);
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <div>
          <p className="font-semibold">Connectivity issue detected</p>
          <p>{statusCopy[status]}</p>
          {rts.lastError && <p className="text-xs text-amber-800">Last error: {rts.lastError}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
        >
          <RefreshCcw className="h-3 w-3" />
          Retry
        </button>
      </div>
    </div>
  );
};

export default ConnectivityBanner;
