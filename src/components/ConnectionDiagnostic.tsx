import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import useConnectivityCheck from '../hooks/useConnectivityCheck';

const ConnectionDiagnostic: React.FC = () => {
  const { snapshot, forceCheck, status } = useConnectivityCheck();
  const [isExpanded, setIsExpanded] = useState(false);
  // Track whether the first real health check has completed.
  const initialLastCheckedRef = useRef(snapshot.lastChecked);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!hasCheckedRef.current) {
      if (snapshot.lastChecked !== initialLastCheckedRef.current) {
        hasCheckedRef.current = true;
      } else {
        return;
      }
    }
    // Only auto-expand when there is a genuine problem after the first check.
    if (status !== 'healthy') {
      setIsExpanded(true);
    }
  }, [status, snapshot.lastChecked]);

  const isHealthy = status === 'healthy';

  // Healthy state: render a tiny minimised pill — not a full panel.
  // Only show it at all if something went wrong; otherwise stay invisible.
  if (isHealthy && !isExpanded) {
    // Don't render anything when everything is fine — no visual clutter.
    return null;
  }

  // Unhealthy + not expanded: small amber/red badge to alert without dominating UI.
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-md transition hover:bg-amber-100"
        title={`Connection issue: ${status}`}
        aria-label="Connection issue detected – click for details"
      >
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        <span>Connection issue</span>
      </button>
    );
  }

  const statusLabel = {
    healthy: 'All systems operational',
    'server-unreachable': 'Server unreachable',
    'api-error': 'API health check failed',
    offline: 'Offline mode',
  }[status] ?? status;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          {isHealthy ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          <span>Connection Status</span>
          <span className="text-xs font-normal text-gray-400">{statusLabel}</span>
        </h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close connection status panel"
        >
          ×
        </button>
      </div>

      <div className="space-y-2 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Internet</span>
          {snapshot.isOnline ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Server</span>
          {snapshot.serverReachable ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">API health</span>
          {snapshot.apiHealthy ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}
        </div>

        <div className="border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-400">Checked: {snapshot.lastChecked.toLocaleTimeString()}</p>
          <button
            onClick={forceCheck}
            className="mt-2 w-full rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-700"
          >
            Refresh Status
          </button>
        </div>

        {!snapshot.isOnline && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            No internet connection. Limited offline functionality available.
          </div>
        )}
        {!snapshot.serverReachable && snapshot.isOnline && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs text-orange-700">
            Cannot reach the server. Try refreshing or check your connection.
          </div>
        )}
        {!snapshot.apiHealthy && snapshot.serverReachable && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-700">
            API health check failed. Some features may be limited.
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionDiagnostic;

