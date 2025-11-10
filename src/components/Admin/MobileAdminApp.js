import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Smartphone, Tablet, Monitor, Wifi, WifiOff, Mic, Bell, Download, Zap } from 'lucide-react';
const MobileAdminApp = () => {
    const [selectedDevice, setSelectedDevice] = useState('mobile');
    const [isOffline, setIsOffline] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [voiceCommands, setVoiceCommands] = useState(false);
    const features = [
        {
            id: 'dashboard',
            name: 'Real-time Dashboard',
            icon: Monitor,
            status: 'available',
            description: 'View key metrics and analytics on-the-go'
        },
        {
            id: 'users',
            name: 'User Management',
            icon: Smartphone,
            status: 'available',
            description: 'Manage users, view profiles, and handle support requests'
        },
        {
            id: 'notifications',
            name: 'Push Notifications',
            icon: Bell,
            status: 'available',
            description: 'Receive instant alerts for critical system events'
        },
        {
            id: 'offline',
            name: 'Offline Sync',
            icon: Download,
            status: 'offline-ready',
            description: 'Access key data and sync when connection returns'
        },
        {
            id: 'voice',
            name: 'Voice Commands',
            icon: Mic,
            status: 'coming-soon',
            description: 'Control admin functions using voice commands'
        },
        {
            id: 'analytics',
            name: 'Mobile Analytics',
            icon: Zap,
            status: 'available',
            description: 'View detailed analytics optimized for mobile viewing'
        }
    ];
    const getDevicePreview = () => {
        const baseClasses = "bg-gray-900 rounded-lg shadow-2xl relative overflow-hidden";
        switch (selectedDevice) {
            case 'mobile':
                return `${baseClasses} w-64 h-96 mx-auto`;
            case 'tablet':
                return `${baseClasses} w-80 h-64 mx-auto`;
            case 'desktop':
                return `${baseClasses} w-96 h-56 mx-auto`;
            default:
                return baseClasses;
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'available':
                return 'bg-green-100 text-green-800';
            case 'offline-ready':
                return 'bg-blue-100 text-blue-800';
            case 'coming-soon':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900", children: "Mobile Admin App" }), _jsx("div", { className: "flex items-center space-x-2", children: isOffline ? (_jsxs("div", { className: "flex items-center space-x-2 text-red-600", children: [_jsx(WifiOff, { className: "w-4 h-4" }), _jsx("span", { className: "text-sm", children: "Offline Mode" })] })) : (_jsxs("div", { className: "flex items-center space-x-2 text-green-600", children: [_jsx(Wifi, { className: "w-4 h-4" }), _jsx("span", { className: "text-sm", children: "Online" })] })) })] }), _jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Device Preview" }), _jsxs("div", { className: "flex items-center justify-center space-x-4 mb-6", children: [_jsxs("button", { onClick: () => setSelectedDevice('mobile'), className: `flex items-center space-x-2 px-4 py-2 rounded-lg ${selectedDevice === 'mobile' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`, children: [_jsx(Smartphone, { className: "w-4 h-4" }), _jsx("span", { children: "Mobile" })] }), _jsxs("button", { onClick: () => setSelectedDevice('tablet'), className: `flex items-center space-x-2 px-4 py-2 rounded-lg ${selectedDevice === 'tablet' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`, children: [_jsx(Tablet, { className: "w-4 h-4" }), _jsx("span", { children: "Tablet" })] }), _jsxs("button", { onClick: () => setSelectedDevice('desktop'), className: `flex items-center space-x-2 px-4 py-2 rounded-lg ${selectedDevice === 'desktop' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`, children: [_jsx(Monitor, { className: "w-4 h-4" }), _jsx("span", { children: "Desktop" })] })] }), _jsx("div", { className: "flex justify-center", children: _jsxs("div", { className: getDevicePreview(), children: [_jsxs("div", { className: "bg-black text-white px-4 py-2 text-xs flex justify-between items-center", children: [_jsx("span", { children: "9:41 AM" }), _jsxs("div", { className: "flex items-center space-x-1", children: [isOffline ? _jsx(WifiOff, { className: "w-3 h-3" }) : _jsx(Wifi, { className: "w-3 h-3" }), _jsxs("div", { className: "flex space-x-1", children: [_jsx("div", { className: "w-1 h-3 bg-white rounded" }), _jsx("div", { className: "w-1 h-3 bg-white rounded" }), _jsx("div", { className: "w-1 h-3 bg-gray-500 rounded" })] })] })] }), _jsxs("div", { className: "bg-blue-600 text-white p-4", children: [_jsx("h4", { className: "font-semibold", children: "Admin Portal" }), _jsx("p", { className: "text-xs text-blue-100", children: "Huddle Co." })] }), _jsxs("div", { className: "p-4 bg-gray-100 flex-1", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { className: "bg-white p-3 rounded shadow-sm", children: [_jsx("div", { className: "text-xs text-gray-600", children: "Active Users" }), _jsx("div", { className: "text-lg font-bold text-gray-900", children: "247" })] }), _jsxs("div", { className: "bg-white p-3 rounded shadow-sm", children: [_jsx("div", { className: "text-xs text-gray-600", children: "Completions" }), _jsx("div", { className: "text-lg font-bold text-gray-900", children: "34" })] })] }), _jsxs("div", { className: "mt-3 space-y-2", children: [_jsx("div", { className: "bg-white p-3 rounded shadow-sm", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-medium", children: "Recent Activity" }), _jsx("div", { className: "w-2 h-2 bg-green-400 rounded-full animate-pulse" })] }) }), _jsx("div", { className: "bg-white p-3 rounded shadow-sm", children: _jsx("div", { className: "text-xs text-gray-600", children: "Sarah completed module" }) })] })] }), selectedDevice === 'mobile' && (_jsx("div", { className: "bg-white border-t border-gray-200 p-2", children: _jsxs("div", { className: "flex justify-around", children: [_jsxs("div", { className: "text-center", children: [_jsx(Monitor, { className: "w-5 h-5 mx-auto text-blue-600" }), _jsx("div", { className: "text-xs text-blue-600", children: "Dashboard" })] }), _jsxs("div", { className: "text-center", children: [_jsx(Smartphone, { className: "w-5 h-5 mx-auto text-gray-400" }), _jsx("div", { className: "text-xs text-gray-400", children: "Users" })] }), _jsxs("div", { className: "text-center", children: [_jsx(Bell, { className: "w-5 h-5 mx-auto text-gray-400" }), _jsx("div", { className: "text-xs text-gray-400", children: "Alerts" })] })] }) }))] }) })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: features.map((feature) => (_jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx(feature.icon, { className: "w-8 h-8 text-blue-600" }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(feature.status)}`, children: feature.status === 'available' ? 'Available' :
                                        feature.status === 'offline-ready' ? 'Offline Ready' : 'Coming Soon' })] }), _jsx("h4", { className: "font-semibold text-gray-900 mb-2", children: feature.name }), _jsx("p", { className: "text-sm text-gray-600", children: feature.description })] }, feature.id))) }), _jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Mobile App Settings" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900", children: "Offline Mode" }), _jsx("p", { className: "text-sm text-gray-600", children: "Enable data caching for offline access" })] }), _jsx("button", { onClick: () => setIsOffline(!isOffline), className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOffline ? 'bg-blue-600' : 'bg-gray-200'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOffline ? 'translate-x-6' : 'translate-x-1'}` }) })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900", children: "Push Notifications" }), _jsx("p", { className: "text-sm text-gray-600", children: "Receive alerts for critical events" })] }), _jsx("button", { onClick: () => setNotifications(!notifications), className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications ? 'bg-blue-600' : 'bg-gray-200'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications ? 'translate-x-6' : 'translate-x-1'}` }) })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900", children: "Voice Commands" }), _jsx("p", { className: "text-sm text-gray-600", children: "Control app using voice (Beta)" })] }), _jsx("button", { onClick: () => setVoiceCommands(!voiceCommands), className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${voiceCommands ? 'bg-blue-600' : 'bg-gray-200'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${voiceCommands ? 'translate-x-6' : 'translate-x-1'}` }) })] })] })] }), _jsxs("div", { className: "bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white", children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Download Mobile App" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-white bg-opacity-20 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "w-10 h-10 bg-white bg-opacity-30 rounded-lg flex items-center justify-center", children: "\uD83D\uDCF1" }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium", children: "iOS App" }), _jsx("p", { className: "text-sm opacity-90", children: "Available on App Store" })] })] }), _jsx("button", { className: "mt-3 w-full bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors", children: "Download for iOS" })] }), _jsxs("div", { className: "bg-white bg-opacity-20 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "w-10 h-10 bg-white bg-opacity-30 rounded-lg flex items-center justify-center", children: "\uD83E\uDD16" }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium", children: "Android App" }), _jsx("p", { className: "text-sm opacity-90", children: "Available on Google Play" })] })] }), _jsx("button", { className: "mt-3 w-full bg-white text-purple-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors", children: "Download for Android" })] })] })] })] }));
};
export default MobileAdminApp;
