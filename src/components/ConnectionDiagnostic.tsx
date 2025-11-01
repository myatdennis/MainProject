import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { api } from '@/lib/api';

interface ConnectionStatus {
  isOnline: boolean;
  serverReachable: boolean;
  apiResponse: boolean;
  lastChecked: Date;
}

const ConnectionDiagnostic: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    serverReachable: false,
    apiResponse: false,
    lastChecked: new Date()
  });
  const [isVisible, setIsVisible] = useState(false);

  const checkConnection = async () => {
    const newStatus: ConnectionStatus = {
      isOnline: navigator.onLine,
      serverReachable: false,
      apiResponse: false,
      lastChecked: new Date()
    };

    // Test server reachability
    try {
      await fetch(window.location.origin, {
        method: 'HEAD',
        mode: 'no-cors'
      });
      newStatus.serverReachable = true;
    } catch (error) {
      console.warn('Server not reachable:', error);
    }

    // Test API response (for when we have real APIs)
    try {
      const apiTest = await api('/api/health', {
        method: 'GET',
        timeout: 5000
      } as any);
      newStatus.apiResponse = apiTest.ok;
    } catch (error) {
      // Expected in demo mode - no real API
      newStatus.apiResponse = false;
    }

    setStatus(newStatus);
  };

  useEffect(() => {
    // Initial check
    checkConnection();

    // Set up periodic checks
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds

    // Listen for online/offline events
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      checkConnection();
    };
    
    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false, serverReachable: false, apiResponse: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-show diagnostic if there are connection issues
  useEffect(() => {
    if (!status.isOnline || !status.serverReachable) {
      setIsVisible(true);
    }
  }, [status.isOnline, status.serverReachable]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="Connection Status"
      >
        {status.isOnline ? (
          <Wifi className="h-4 w-4 text-green-400" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-400" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 flex items-center">
          <Info className="h-4 w-4 mr-2" />
          Connection Status
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
          {status.isOnline ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span>Server Reachable</span>
          {status.serverReachable ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span>Demo Mode</span>
          <Info className="h-4 w-4 text-blue-500" />
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            Last checked: {status.lastChecked.toLocaleTimeString()}
          </div>
          <button
            onClick={checkConnection}
            className="mt-2 w-full bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
          >
            Refresh Status
          </button>
        </div>

        {!status.isOnline && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            No internet connection. The app will work in offline mode with limited functionality.
          </div>
        )}

        {!status.serverReachable && status.isOnline && (
          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
            Development server may not be running. Try refreshing the page or restarting the server with `npm run dev`.
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionDiagnostic;
