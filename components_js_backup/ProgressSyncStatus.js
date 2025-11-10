import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertTriangle, Clock, Save, Upload, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { clearOfflineQueue } from '../dal/offlineQueue';
const ProgressSyncStatus = ({ isOnline, isSaving, syncStatus, pendingChanges, queueSize, queuedItems = [], isProcessingQueue = false, lastSaved, onForceSave, onFlushQueue, showDetailed = false }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [isFlushingQueue, setIsFlushingQueue] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState('');
    const currentQueueSize = useMemo(() => {
        if (typeof queueSize === 'number') {
            return queueSize;
        }
        return queuedItems.length;
    }, [queueSize, queuedItems.length]);
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
                }
                else if (diffSecs > 30) {
                    setLastSyncTime(`${diffSecs}s ago`);
                }
                else {
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
                }
                else {
                    toast.error('Some changes could not be saved');
                }
            }
            catch (error) {
                toast.error('Failed to save changes');
            }
        }
    };
    const handleFlushQueue = async () => {
        if (!onFlushQueue || isFlushingQueue) {
            return;
        }
        try {
            setIsFlushingQueue(true);
            await onFlushQueue();
            toast.success('Queued progress submitted for syncing', { id: 'sync-flush-success' });
        }
        catch (error) {
            toast.error('Unable to flush queued progress right now', { id: 'sync-flush-failure' });
        }
        finally {
            setIsFlushingQueue(false);
        }
    };
    const handleClearQueue = async () => {
        const confirm = window.confirm('Clear all queued offline progress? This cannot be undone.');
        if (!confirm)
            return;
        try {
            await clearOfflineQueue();
            toast.success('Offline queue cleared', { id: 'offline-queue-cleared' });
        }
        catch (e) {
            toast.error('Failed to clear offline queue', { id: 'offline-queue-clear-failed' });
        }
    };
    const getStatusColor = () => {
        if (!isOnline)
            return 'text-red-600 bg-red-50';
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
            return _jsx(WifiOff, { className: "w-4 h-4" });
        }
        if (isSaving) {
            return _jsx(RefreshCw, { className: "w-4 h-4 animate-spin" });
        }
        switch (syncStatus) {
            case 'synced':
                return _jsx(CheckCircle, { className: "w-4 h-4" });
            case 'pending':
                return _jsx(Clock, { className: "w-4 h-4" });
            case 'error':
                return _jsx(AlertTriangle, { className: "w-4 h-4" });
            default:
                return _jsx(RefreshCw, { className: "w-4 h-4" });
        }
    };
    const getStatusText = () => {
        if (!isOnline)
            return 'Offline';
        if (isSaving)
            return 'Saving...';
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
        return (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200 p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-sm font-medium text-gray-900", children: "Progress Status" }), _jsx("button", { onClick: () => setShowDetails(!showDetails), className: "text-gray-400 hover:text-gray-600", children: _jsx(RefreshCw, { className: `w-4 h-4 ${showDetails ? 'rotate-180' : ''} transition-transform` }) })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [isOnline ? (_jsx(Wifi, { className: "w-4 h-4 text-green-600" })) : (_jsx(WifiOff, { className: "w-4 h-4 text-red-600" })), _jsx("span", { className: "text-sm text-gray-700", children: "Connection" })] }), _jsx("span", { className: `text-xs px-2 py-1 rounded-full ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`, children: isOnline ? 'Online' : 'Offline' })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [getStatusIcon(), _jsx("span", { className: "text-sm text-gray-700", children: "Sync Status" })] }), _jsx("span", { className: `text-xs px-2 py-1 rounded-full ${getStatusColor()}`, children: getStatusText() })] }), pendingChanges > 0 && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Upload, { className: "w-4 h-4 text-yellow-600" }), _jsx("span", { className: "text-sm text-gray-700", children: "Pending Changes" })] }), _jsx("span", { className: "text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800", children: pendingChanges })] })), currentQueueSize > 0 && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Download, { className: "w-4 h-4 text-blue-600" }), _jsx("span", { className: "text-sm text-gray-700", children: "Queued Items" })] }), _jsx("span", { className: "text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800", children: currentQueueSize })] })), lastSaved && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Clock, { className: "w-4 h-4 text-gray-400" }), _jsx("span", { className: "text-sm text-gray-700", children: "Last Saved" })] }), _jsx("span", { className: "text-xs text-gray-500", children: lastSyncTime })] }))] }), currentQueueSize > 0 && (_jsxs("div", { className: "mt-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h4", { className: "text-xs font-semibold uppercase tracking-wide text-gray-500", children: "Queued for Sync" }), onFlushQueue && (_jsxs("button", { onClick: handleFlushQueue, disabled: isFlushingQueue || isProcessingQueue, className: "inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60", children: [_jsx(RefreshCw, { className: `w-3 h-3 ${isFlushingQueue || isProcessingQueue ? 'animate-spin' : ''}` }), isProcessingQueue ? 'Syncing…' : 'Sync now'] })), currentQueueSize > 0 && (_jsxs("button", { onClick: handleClearQueue, className: "ml-2 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 border border-red-200", title: "Clear queued items", children: [_jsx(Trash2, { className: "w-3 h-3" }), "Clear"] }))] }), _jsx("ul", { className: "max-h-40 space-y-2 overflow-y-auto", children: queuedItems.map((item) => (_jsxs("li", { className: "rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-semibold capitalize", children: item.action.replace('_', ' ') }), _jsx("span", { className: "text-[11px] text-blue-700", children: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })] }), _jsxs("div", { className: "mt-1 flex flex-wrap gap-x-4 text-[11px] text-blue-800", children: [item.lessonId && _jsxs("span", { children: ["Lesson: ", item.lessonId] }), item.moduleId && _jsxs("span", { children: ["Module: ", item.moduleId] }), _jsxs("span", { children: ["Attempts: ", item.attempts] }), _jsxs("span", { children: ["Priority: ", item.priority] })] })] }, item.id))) })] })), showDetails && (_jsxs("div", { className: "mt-4 pt-4 border-t border-gray-200", children: [_jsxs("div", { className: "flex space-x-2", children: [onForceSave && (_jsxs("button", { onClick: handleForceSave, disabled: isSaving, className: "flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed", children: [_jsx(Save, { className: "w-3 h-3 inline mr-1" }), "Force Save"] })), _jsxs("button", { onClick: () => window.location.reload(), className: "flex-1 px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-700", children: [_jsx(RefreshCw, { className: "w-3 h-3 inline mr-1" }), "Reload"] })] }), _jsxs("div", { className: "mt-3 text-xs text-gray-500", children: [!isOnline && (_jsx("p", { className: "bg-red-50 text-red-700 p-2 rounded", children: "\u26A0\uFE0F You're offline. Changes are saved locally and will sync when connection is restored." })), pendingChanges > 0 && isOnline && (_jsxs("p", { className: "bg-yellow-50 text-yellow-700 p-2 rounded", children: ["\uD83D\uDCE4 ", pendingChanges, " changes are being saved automatically."] })), (isProcessingQueue || isFlushingQueue) && (_jsxs("p", { className: "bg-blue-50 text-blue-700 p-2 rounded flex items-center space-x-2", children: [_jsx(RefreshCw, { className: "w-4 h-4 animate-spin" }), _jsx("span", { children: "Syncing queued progress in the background\u2026" })] })), syncStatus === 'error' && (_jsxs("p", { className: "bg-red-50 text-red-700 p-2 rounded flex items-center space-x-2", children: [_jsx(RefreshCw, { className: "w-4 h-4 animate-spin" }), _jsx("span", { children: "We couldn't reach the server. We'll keep retrying automatically\u2014double-check your connection or click \"Force Save\" once you're back online." })] }))] })] }))] }));
    }
    // Compact display
    return (_jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-3", children: [_jsxs("div", { className: `flex items-center gap-1 text-sm sm:text-xs ${isOnline ? 'text-green-600' : 'text-red-600'}`, children: [isOnline ? _jsx(Wifi, { className: "w-4 h-4" }) : _jsx(WifiOff, { className: "w-4 h-4" }), _jsx("span", { children: isOnline ? 'Online' : 'Offline' })] }), _jsxs("div", { className: `flex items-center gap-1 text-sm sm:text-xs ${getStatusColor()}`, children: [getStatusIcon(), _jsx("span", { children: getStatusText() }), pendingChanges > 0 && (_jsx("span", { className: "ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800", children: pendingChanges }))] }), currentQueueSize > 0 && (_jsxs("div", { className: "flex items-center gap-1 text-xs text-blue-700", children: [_jsx(Download, { className: "w-3 h-3" }), _jsxs("span", { children: [currentQueueSize, " queued"] }), onFlushQueue && (_jsxs("button", { onClick: handleFlushQueue, disabled: isProcessingQueue || isFlushingQueue, className: "inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-60", children: [_jsx(RefreshCw, { className: `w-3 h-3 ${isProcessingQueue || isFlushingQueue ? 'animate-spin' : ''}` }), "Sync"] })), currentQueueSize > 0 && (_jsxs("button", { onClick: handleClearQueue, className: "inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100 border border-red-200", title: "Clear queued items", children: [_jsx(Trash2, { className: "w-3 h-3" }), "Clear"] }))] })), onForceSave && (pendingChanges > 0 || syncStatus === 'error') && (_jsxs("button", { onClick: handleForceSave, disabled: isSaving, className: "inline-flex items-center justify-center rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50", children: [_jsx(Save, { className: "mr-1 h-3 w-3" }), "Save"] }))] }));
};
export default ProgressSyncStatus;
