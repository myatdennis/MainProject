import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Wifi, WifiOff, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { api } from '../lib/api';
const ConnectionDiagnostic = () => {
    const [status, setStatus] = useState({
        isOnline: navigator.onLine,
        serverReachable: false,
        apiResponse: false,
        lastChecked: new Date()
    });
    const [isVisible, setIsVisible] = useState(false);
    const checkConnection = async () => {
        const newStatus = {
            isOnline: navigator.onLine,
            serverReachable: false,
            apiResponse: false,
            lastChecked: new Date()
        };
        // Test server reachability
        try {
            await fetch(window.location.origin, {
                method: 'HEAD',
                mode: 'no-cors',
                credentials: 'include'
            });
            newStatus.serverReachable = true;
        }
        catch (error) {
            console.warn('Server not reachable:', error);
        }
        // Test API response (for when we have real APIs)
        try {
            const apiTest = await api('/api/health', {
                method: 'GET',
                timeout: 5000
            });
            newStatus.apiResponse = apiTest.ok;
        }
        catch (error) {
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
        return (_jsx("button", { onClick: () => setIsVisible(true), className: "fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors", title: "Connection Status", children: status.isOnline ? (_jsx(Wifi, { className: "h-4 w-4 text-green-400" })) : (_jsx(WifiOff, { className: "h-4 w-4 text-red-400" })) }));
    }
    return (_jsxs("div", { className: "fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("h3", { className: "font-semibold text-gray-900 flex items-center", children: [_jsx(Info, { className: "h-4 w-4 mr-2" }), "Connection Status"] }), _jsx("button", { onClick: () => setIsVisible(false), className: "text-gray-400 hover:text-gray-600", children: "\u00D7" })] }), _jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: "Internet Connection" }), status.isOnline ? (_jsx(CheckCircle, { className: "h-4 w-4 text-green-500" })) : (_jsx(AlertTriangle, { className: "h-4 w-4 text-red-500" }))] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: "Server Reachable" }), status.serverReachable ? (_jsx(CheckCircle, { className: "h-4 w-4 text-green-500" })) : (_jsx(AlertTriangle, { className: "h-4 w-4 text-orange-500" }))] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: "Demo Mode" }), _jsx(Info, { className: "h-4 w-4 text-blue-500" })] }), _jsxs("div", { className: "pt-2 border-t border-gray-100", children: [_jsxs("div", { className: "text-xs text-gray-500", children: ["Last checked: ", status.lastChecked.toLocaleTimeString()] }), _jsx("button", { onClick: checkConnection, className: "mt-2 w-full bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors", children: "Refresh Status" })] }), !status.isOnline && (_jsx("div", { className: "mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700", children: "No internet connection. The app will work in offline mode with limited functionality." })), !status.serverReachable && status.isOnline && (_jsx("div", { className: "mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700", children: "Development server may not be running. Try refreshing the page or restarting the server with `npm run dev`." }))] })] }));
};
export default ConnectionDiagnostic;
