/**
 * AdminSettings - Admin portal page for managing profile, notifications, security, system, branding, and integrations.
 * Uses shared UI components and accessibility best practices.
 * Features: tabbed settings, form controls, modals, and summary stats.
 */

import { useState } from 'react';
import {
  User,
  Bell,
  Shield,
  Database,
  Palette,
  Globe,
  Save,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [showApiKey, setShowApiKey] = useState(false);
  const [settings, setSettings] = useState({
    profile: {
      name: 'Mya Dennis',
      email: 'mya@thehuddleco.com',
      title: 'Founder & Lead Facilitator',
      bio: 'Passionate about creating inclusive workplaces where everyone can thrive.',
      phone: '+1 (555) 123-4567',
      timezone: 'America/New_York'
    },
    notifications: {
      emailNewEnrollment: true,
      emailCourseCompletion: true,
      emailFeedbackSubmitted: true,
      emailWeeklyReport: true,
      emailSystemAlerts: true,
      pushNewEnrollment: false,
      pushCourseCompletion: true,
      pushSystemAlerts: true
    },
    security: {
      twoFactorEnabled: true,
      sessionTimeout: 60,
      passwordExpiry: 90,
      loginAttempts: 5
    },
    system: {
      maintenanceMode: false,
      allowNewRegistrations: true,
      requireEmailVerification: true,
      autoArchiveInactive: 180,
      backupFrequency: 'daily'
    },
    branding: {
      primaryColor: '#de7b12',
      secondaryColor: '#D72638',
      accentColor: '#3A7DFF',
      logoUrl: '',
      faviconUrl: '',
      customCss: ''
    },
    integrations: {
      mailchimpApiKey: '',
      stripeApiKey: '',
      zoomApiKey: '',
      slackWebhook: '',
      googleAnalyticsId: ''
    }
  });

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'system', name: 'System', icon: Database },
    { id: 'branding', name: 'Branding', icon: Palette },
    { id: 'integrations', name: 'Integrations', icon: Globe }
  ];

  const handleInputChange = (section: string, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    // In a real app, this would save to your backend
    console.log('Saving settings:', settings);
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-6">
        <div className="relative">
          <img
            src="https://images.pexels.com/photos/3184416/pexels-photo-3184416.jpeg?auto=compress&cs=tinysrgb&w=200"
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover"
          />
          <button
            type="button"
            className="absolute -bottom-2 -right-2 bg-white border border-gray-200 rounded-full p-2 shadow-sm hover:bg-gray-50"
            title="Upload new photo"
          >
            <Upload className="h-4 w-4 text-gray-700" />
          </button>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Profile Photo</h3>
          <p className="text-sm text-gray-600">Upload a professional photo for your admin profile</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
          <input
            type="text"
            value={settings.profile.name}
            onChange={(e) => handleInputChange('profile', 'name', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
          <input
            type="email"
            value={settings.profile.email}
            onChange={(e) => handleInputChange('profile', 'email', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
          <input
            type="text"
            value={settings.profile.title}
            onChange={(e) => handleInputChange('profile', 'title', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
          <input
            type="tel"
            value={settings.profile.phone}
            onChange={(e) => handleInputChange('profile', 'phone', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
        <textarea
          value={settings.profile.bio}
          onChange={(e) => handleInputChange('profile', 'bio', e.target.value)}
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
        <select
          value={settings.profile.timezone}
          onChange={(e) => handleInputChange('profile', 'timezone', e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          <option value="America/New_York">Eastern Time (ET)</option>
          <option value="America/Chicago">Central Time (CT)</option>
          <option value="America/Denver">Mountain Time (MT)</option>
          <option value="America/Los_Angeles">Pacific Time (PT)</option>
        </select>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Email Notifications</h3>
        <div className="space-y-4">
          {[
            { key: 'emailNewEnrollment', label: 'New learner enrollments', description: 'Get notified when someone joins a course' },
            { key: 'emailCourseCompletion', label: 'Course completions', description: 'Get notified when learners complete modules' },
            { key: 'emailFeedbackSubmitted', label: 'Feedback submissions', description: 'Get notified when learners submit feedback' },
            { key: 'emailWeeklyReport', label: 'Weekly progress reports', description: 'Receive weekly summary of platform activity' },
            { key: 'emailSystemAlerts', label: 'System alerts', description: 'Important system notifications and updates' }
          ].map((notification) => (
            <div key={notification.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">{notification.label}</div>
                <div className="text-sm text-gray-600">{notification.description}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications[notification.key as keyof typeof settings.notifications] as boolean}
                  onChange={(e) => handleInputChange('notifications', notification.key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Push Notifications</h3>
        <div className="space-y-4">
          {[
            { key: 'pushNewEnrollment', label: 'New enrollments', description: 'Browser notifications for new learners' },
            { key: 'pushCourseCompletion', label: 'Course completions', description: 'Browser notifications for completions' },
            { key: 'pushSystemAlerts', label: 'System alerts', description: 'Critical system notifications' }
          ].map((notification) => (
            <div key={notification.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">{notification.label}</div>
                <div className="text-sm text-gray-600">{notification.description}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications[notification.key as keyof typeof settings.notifications] as boolean}
                  onChange={(e) => handleInputChange('notifications', notification.key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span className="font-medium text-green-800">Security Status: Good</span>
        </div>
        <p className="text-sm text-green-700 mt-1">Your account security settings are properly configured.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Session Timeout (minutes)</label>
          <input
            type="number"
            value={settings.security.sessionTimeout}
            onChange={(e) => handleInputChange('security', 'sessionTimeout', parseInt(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Password Expiry (days)</label>
          <input
            type="number"
            value={settings.security.passwordExpiry}
            onChange={(e) => handleInputChange('security', 'passwordExpiry', parseInt(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">Two-Factor Authentication</div>
            <div className="text-sm text-gray-600">Add an extra layer of security to your account</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.security.twoFactorEnabled}
              onChange={(e) => handleInputChange('security', 'twoFactorEnabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900">API Access</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">API Key</label>
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="text-sm text-orange-500 hover:text-orange-600 flex items-center space-x-1"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span>{showApiKey ? 'Hide' : 'Show'}</span>
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              value="hc_live_1234567890abcdef"
              readOnly
              className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
            />
            <button className="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-1">
              <RefreshCw className="h-4 w-4" />
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSystemTab = () => (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <span className="font-medium text-yellow-800">System Configuration</span>
        </div>
        <p className="text-sm text-yellow-700 mt-1">Changes to these settings affect all users and organizations.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">Maintenance Mode</div>
            <div className="text-sm text-gray-600">Temporarily disable access for system updates</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.system.maintenanceMode}
              onChange={(e) => handleInputChange('system', 'maintenanceMode', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">Allow New Registrations</div>
            <div className="text-sm text-gray-600">Enable new organizations to request access</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.system.allowNewRegistrations}
              onChange={(e) => handleInputChange('system', 'allowNewRegistrations', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">Require Email Verification</div>
            <div className="text-sm text-gray-600">New users must verify their email address</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.system.requireEmailVerification}
              onChange={(e) => handleInputChange('system', 'requireEmailVerification', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Auto-archive Inactive Users (days)</label>
          <input
            type="number"
            value={settings.system.autoArchiveInactive}
            onChange={(e) => handleInputChange('system', 'autoArchiveInactive', parseInt(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Backup Frequency</label>
          <select
            value={settings.system.backupFrequency}
            onChange={(e) => handleInputChange('system', 'backupFrequency', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderBrandingTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Brand Colors</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={settings.branding.primaryColor}
                onChange={(e) => handleInputChange('branding', 'primaryColor', e.target.value)}
                className="w-12 h-12 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={settings.branding.primaryColor}
                onChange={(e) => handleInputChange('branding', 'primaryColor', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={settings.branding.secondaryColor}
                onChange={(e) => handleInputChange('branding', 'secondaryColor', e.target.value)}
                className="w-12 h-12 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={settings.branding.secondaryColor}
                onChange={(e) => handleInputChange('branding', 'secondaryColor', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Accent Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={settings.branding.accentColor}
                onChange={(e) => handleInputChange('branding', 'accentColor', e.target.value)}
                className="w-12 h-12 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={settings.branding.accentColor}
                onChange={(e) => handleInputChange('branding', 'accentColor', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Logo & Assets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo URL</label>
            <input
              type="url"
              value={settings.branding.logoUrl}
              onChange={(e) => handleInputChange('branding', 'logoUrl', e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Favicon URL</label>
            <input
              type="url"
              value={settings.branding.faviconUrl}
              onChange={(e) => handleInputChange('branding', 'faviconUrl', e.target.value)}
              placeholder="https://example.com/favicon.ico"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Custom CSS</label>
        <textarea
          value={settings.branding.customCss}
          onChange={(e) => handleInputChange('branding', 'customCss', e.target.value)}
          rows={8}
          placeholder="/* Add your custom CSS here */"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
        />
      </div>
    </div>
  );

  const renderIntegrationsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Mailchimp API Key</label>
          <input
            type="password"
            value={settings.integrations.mailchimpApiKey}
            onChange={(e) => handleInputChange('integrations', 'mailchimpApiKey', e.target.value)}
            placeholder="Enter Mailchimp API key"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Stripe API Key</label>
          <input
            type="password"
            value={settings.integrations.stripeApiKey}
            onChange={(e) => handleInputChange('integrations', 'stripeApiKey', e.target.value)}
            placeholder="Enter Stripe API key"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Zoom API Key</label>
          <input
            type="password"
            value={settings.integrations.zoomApiKey}
            onChange={(e) => handleInputChange('integrations', 'zoomApiKey', e.target.value)}
            placeholder="Enter Zoom API key"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Slack Webhook URL</label>
          <input
            type="url"
            value={settings.integrations.slackWebhook}
            onChange={(e) => handleInputChange('integrations', 'slackWebhook', e.target.value)}
            placeholder="Enter Slack webhook URL"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Google Analytics ID</label>
        <input
          type="text"
          value={settings.integrations.googleAnalyticsId}
          onChange={(e) => handleInputChange('integrations', 'googleAnalyticsId', e.target.value)}
          placeholder="GA-XXXXXXXXX-X"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Integration Status</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">Email Marketing</span>
            <span className="text-sm text-green-600 flex items-center">
              <CheckCircle className="h-4 w-4 mr-1" />
              Connected
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">Payment Processing</span>
            <span className="text-sm text-yellow-600 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Not Configured
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">Video Conferencing</span>
            <span className="text-sm text-green-600 flex items-center">
              <CheckCircle className="h-4 w-4 mr-1" />
              Connected
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your admin profile, system configuration, and integrations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'bg-orange-50 text-orange-600 border-r-2 border-orange-500'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                {tabs.find(tab => tab.id === activeTab)?.name}
              </h2>
              <button
                onClick={handleSave}
                className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </button>
            </div>

            {activeTab === 'profile' && renderProfileTab()}
            {activeTab === 'notifications' && renderNotificationsTab()}
            {activeTab === 'security' && renderSecurityTab()}
            {activeTab === 'system' && renderSystemTab()}
            {activeTab === 'branding' && renderBrandingTab()}
            {activeTab === 'integrations' && renderIntegrationsTab()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;