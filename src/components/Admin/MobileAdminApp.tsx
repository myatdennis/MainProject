import React, { useState } from 'react';
import { Smartphone, Tablet, Monitor, Wifi, WifiOff, Mic, Bell, Download, Zap } from 'lucide-react';

interface MobileFeature {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  status: 'available' | 'coming-soon' | 'offline-ready';
  description: string;
}

const MobileAdminApp: React.FC = () => {
  const [selectedDevice, setSelectedDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [isOffline, setIsOffline] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [voiceCommands, setVoiceCommands] = useState(false);

  const features: MobileFeature[] = [
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

  const getStatusColor = (status: MobileFeature['status']) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Mobile Admin App</h2>
        <div className="flex items-center space-x-2">
          {isOffline ? (
            <div className="flex items-center space-x-2 text-red-600">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm">Offline Mode</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-green-600">
              <Wifi className="w-4 h-4" />
              <span className="text-sm">Online</span>
            </div>
          )}
        </div>
      </div>

      {/* Device Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Preview</h3>
        
        <div className="flex items-center justify-center space-x-4 mb-6">
          <button
            onClick={() => setSelectedDevice('mobile')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              selectedDevice === 'mobile' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobile</span>
          </button>
          <button
            onClick={() => setSelectedDevice('tablet')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              selectedDevice === 'tablet' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Tablet className="w-4 h-4" />
            <span>Tablet</span>
          </button>
          <button
            onClick={() => setSelectedDevice('desktop')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              selectedDevice === 'desktop' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Desktop</span>
          </button>
        </div>

        {/* Device Mockup */}
        <div className="flex justify-center">
          <div className={getDevicePreview()}>
            {/* Status Bar */}
            <div className="bg-black text-white px-4 py-2 text-xs flex justify-between items-center">
              <span>9:41 AM</span>
              <div className="flex items-center space-x-1">
                {isOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                <div className="flex space-x-1">
                  <div className="w-1 h-3 bg-white rounded"></div>
                  <div className="w-1 h-3 bg-white rounded"></div>
                  <div className="w-1 h-3 bg-gray-500 rounded"></div>
                </div>
              </div>
            </div>

            {/* App Header */}
            <div className="bg-blue-600 text-white p-4">
              <h4 className="font-semibold">Admin Portal</h4>
              <p className="text-xs text-blue-100">Huddle Co.</p>
            </div>

            {/* App Content */}
            <div className="p-4 bg-gray-100 flex-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-3 rounded shadow-sm">
                  <div className="text-xs text-gray-600">Active Users</div>
                  <div className="text-lg font-bold text-gray-900">247</div>
                </div>
                <div className="bg-white p-3 rounded shadow-sm">
                  <div className="text-xs text-gray-600">Completions</div>
                  <div className="text-lg font-bold text-gray-900">34</div>
                </div>
              </div>
              
              <div className="mt-3 space-y-2">
                <div className="bg-white p-3 rounded shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Recent Activity</span>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div className="bg-white p-3 rounded shadow-sm">
                  <div className="text-xs text-gray-600">Sarah completed module</div>
                </div>
              </div>
            </div>

            {/* Bottom Navigation */}
            {selectedDevice === 'mobile' && (
              <div className="bg-white border-t border-gray-200 p-2">
                <div className="flex justify-around">
                  <div className="text-center">
                    <Monitor className="w-5 h-5 mx-auto text-blue-600" />
                    <div className="text-xs text-blue-600">Dashboard</div>
                  </div>
                  <div className="text-center">
                    <Smartphone className="w-5 h-5 mx-auto text-gray-400" />
                    <div className="text-xs text-gray-400">Users</div>
                  </div>
                  <div className="text-center">
                    <Bell className="w-5 h-5 mx-auto text-gray-400" />
                    <div className="text-xs text-gray-400">Alerts</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <div key={feature.id} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <feature.icon className="w-8 h-8 text-blue-600" />
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(feature.status)}`}>
                {feature.status === 'available' ? 'Available' : 
                 feature.status === 'offline-ready' ? 'Offline Ready' : 'Coming Soon'}
              </span>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">{feature.name}</h4>
            <p className="text-sm text-gray-600">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Mobile Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Mobile App Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Offline Mode</h4>
              <p className="text-sm text-gray-600">Enable data caching for offline access</p>
            </div>
            <button
              onClick={() => setIsOffline(!isOffline)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isOffline ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isOffline ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Push Notifications</h4>
              <p className="text-sm text-gray-600">Receive alerts for critical events</p>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notifications ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Voice Commands</h4>
              <p className="text-sm text-gray-600">Control app using voice (Beta)</p>
            </div>
            <button
              onClick={() => setVoiceCommands(!voiceCommands)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                voiceCommands ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                voiceCommands ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Download Links */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">Download Mobile App</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-30 rounded-lg flex items-center justify-center">
                📱
              </div>
              <div>
                <h4 className="font-medium">iOS App</h4>
                <p className="text-sm opacity-90">Available on App Store</p>
              </div>
            </div>
            <button className="mt-3 w-full bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors">
              Download for iOS
            </button>
          </div>

          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-30 rounded-lg flex items-center justify-center">
                🤖
              </div>
              <div>
                <h4 className="font-medium">Android App</h4>
                <p className="text-sm opacity-90">Available on Google Play</p>
              </div>
            </div>
            <button className="mt-3 w-full bg-white text-purple-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors">
              Download for Android
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileAdminApp;