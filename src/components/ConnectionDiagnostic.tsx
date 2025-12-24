import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import useConnectivityCheck from '../hooks/useConnectivityCheck';

const ConnectionDiagnostic: React.FC = () => {
  const { snapshot, forceCheck, status } = useConnectivityCheck();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (status !== 'healthy') setIsVisible(true);
  }, [status]);

  const statusLabel = {
    healthy: 'All systems operational',
    'server-unreachable': 'Server unreachable',
    'api-error': 'API health check failed',
    offline: 'Offline mode',
  }[status];

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white px-3 py-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
        title="Connection Status"
      >
        {snapshot.isOnline ? (
          <Wifi className="h-4 w-4 text-green-400" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-400" />
        )}
        <span className="text-xs font-semibold">{statusLabel}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Info className="h-4 w-4" />
          <span>Connection Status</span>
          <span className="text-xs font-medium text-gray-500">{statusLabel}</span>
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span>Internet Connection</span>
          {snapshot.isOnline ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span>Server Reachable</span>
          {snapshot.serverReachable ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span>API Health</span>
          {snapshot.apiHealthy ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            Last checked: {snapshot.lastChecked.toLocaleTimeString()}
          </div>
          <button
            onClick={forceCheck}
            className="mt-2 w-full bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
          >
            Refresh Status
          </button>
        </div>

          {!snapshot.isOnline && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            No internet connection. The app will work in offline mode with limited functionality.
          </div>
        )}

        {!snapshot.serverReachable && snapshot.isOnline && (
          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
            Development server may not be running. Try refreshing the page or restarting the server with `npm run dev`.
          </div>
        )}

          {!snapshot.apiHealthy && snapshot.serverReachable && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
              API health check failed. Review server logs or restart the Express API.
            </div>
          )}
      </div>
    </div>
  );
};

export default ConnectionDiagnostic;
