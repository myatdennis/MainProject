import { useEffect, useState } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Save,
  Upload,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProgressSyncStatusProps {
  isOnline: boolean;
  isSaving: boolean;
  syncStatus: 'synced' | 'pending' | 'error';
  pendingChanges: number;
  queueSize?: number;
  lastSaved?: Date | null;
  onForceSave?: () => Promise<boolean>;
  showDetailed?: boolean;
}

const ProgressSyncStatus = ({
  isOnline,
  isSaving,
  syncStatus,
  pendingChanges,
  queueSize = 0,
  lastSaved,
  onForceSave,
  showDetailed = false
}: ProgressSyncStatusProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Update last sync time display
  useEffect(() => {
    if (lastSaved) {
      const updateTime = () => {
        const now = new Date();
        const diffMs = now.getTime() - lastSaved.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        
        if (diffMins > 0) {
          setLastSyncTime(`${diffMins}m ago`);
        } else if (diffSecs > 30) {
          setLastSyncTime(`${diffSecs}s ago`);
        } else {
          setLastSyncTime('Just now');
        }
      };
      
      updateTime();
      const interval = setInterval(updateTime, 10000); // Update every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [lastSaved]);

  const handleForceSave = async () => {
    if (onForceSave) {
      try {
        const success = await onForceSave();
        if (success) {
          toast.success('All changes saved successfully');
        } else {
          toast.error('Some changes could not be saved');
        }
      } catch (error) {
        toast.error('Failed to save changes');
      }
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-600 bg-red-50';
    
    switch (syncStatus) {
      case 'synced':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="w-4 h-4" />;
    }
    
    if (isSaving) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    
    switch (syncStatus) {
      case 'synced':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <RefreshCw className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSaving) return 'Saving...';
    
    switch (syncStatus) {
      case 'synced':
        return 'All saved';
      case 'pending':
        return 'Saving changes';
      case 'error':
        return 'Sync error';
      default:
        return 'Unknown';
    }
  };

  if (showDetailed) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">Progress Status</h3>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-gray-400 hover:text-gray-600"
          >
            <RefreshCw className={`w-4 h-4 ${showDetails ? 'rotate-180' : ''} transition-transform`} />
          </button>
        </div>

        {/* Connection Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-600" />
              )}
              <span className="text-sm text-gray-700">Connection</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Sync Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className="text-sm text-gray-700">Sync Status</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>

          {/* Pending Changes */}
          {pendingChanges > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Upload className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-gray-700">Pending Changes</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                {pendingChanges}
              </span>
            </div>
          )}

          {/* Queue Size (Offline) */}
          {queueSize > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Download className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">Queued Items</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                {queueSize}
              </span>
            </div>
          )}

          {/* Last Sync Time */}
          {lastSaved && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">Last Saved</span>
              </div>
              <span className="text-xs text-gray-500">{lastSyncTime}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex space-x-2">
              {onForceSave && (
                <button
                  onClick={handleForceSave}
                  disabled={isSaving}
                  className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-3 h-3 inline mr-1" />
                  Force Save
                </button>
              )}
              
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                <RefreshCw className="w-3 h-3 inline mr-1" />
                Reload
              </button>
            </div>
            
            {/* Status Messages */}
            <div className="mt-3 text-xs text-gray-500">
              {!isOnline && (
                <p className="bg-red-50 text-red-700 p-2 rounded">
                  ⚠️ You're offline. Changes are saved locally and will sync when connection is restored.
                </p>
              )}
              
              {pendingChanges > 0 && isOnline && (
                <p className="bg-yellow-50 text-yellow-700 p-2 rounded">
                  📤 {pendingChanges} changes are being saved automatically.
                </p>
              )}
              
              {syncStatus === 'error' && (
                <p className="bg-red-50 text-red-700 p-2 rounded">
                  ❌ Sync error occurred. Click "Force Save" to retry.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Compact display
  return (
    <div className="flex items-center space-x-3">
      {/* Connection Indicator */}
      <div className={`flex items-center space-x-1 ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
        {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        <span className="text-xs hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
      </div>

      {/* Sync Status */}
      <div className={`flex items-center space-x-1 text-xs ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="hidden sm:inline">{getStatusText()}</span>
        
        {/* Pending Changes Badge */}
        {pendingChanges > 0 && (
          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs ml-2">
            {pendingChanges}
          </span>
        )}
      </div>

      {/* Force Save Button */}
      {onForceSave && (pendingChanges > 0 || syncStatus === 'error') && (
        <button
          onClick={handleForceSave}
          disabled={isSaving}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-3 h-3 inline sm:mr-1" />
          <span className="hidden sm:inline">Save</span>
        </button>
      )}
    </div>
  );
};

export default ProgressSyncStatus;