import React, { useState } from 'react';
import { X, Settings, Users, Shield, Bell } from 'lucide-react';

interface SurveySettings {
  accessControl: {
    requireAuth: boolean;
    allowAnonymous: boolean;
    ipRestriction: string;
    timeLimit: number;
  };
  notifications: {
    sendReminders: boolean;
    reminderFrequency: string;
    completionNotifications: boolean;
  };
  advanced: {
    allowBack: boolean;
    showProgress: boolean;
    randomizeQuestions: boolean;
    preventMultipleSubmissions: boolean;
  };
}

interface SurveySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SurveySettings;
  onSave: (settings: SurveySettings) => void;
}

const SurveySettingsModal: React.FC<SurveySettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave
}) => {
  const [tempSettings, setTempSettings] = useState<SurveySettings>(settings);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(tempSettings);
    onClose();
  };

  const updateSettings = (section: keyof SurveySettings, key: string, value: any) => {
    setTempSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-gray-100 p-2 rounded-lg">
              <Settings className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-xl font-bold text-gray-900">
                Survey Settings
              </h2>
              <p className="text-sm text-gray-600">
                Configure access control, notifications, and advanced options
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            aria-label="Close settings modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Access Control */}
          <section>
            <div className="flex items-center space-x-2 mb-4">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Access Control</h3>
            </div>
            <div className="space-y-4 pl-7">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={tempSettings.accessControl.requireAuth}
                  onChange={(e) => updateSettings('accessControl', 'requireAuth', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Require authentication</span>
              </label>
              
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={tempSettings.accessControl.allowAnonymous}
                  onChange={(e) => updateSettings('accessControl', 'allowAnonymous', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Allow anonymous responses</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time limit (minutes, 0 = no limit)
                </label>
                <input
                  type="number"
                  value={tempSettings.accessControl.timeLimit}
                  onChange={(e) => updateSettings('accessControl', 'timeLimit', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section>
            <div className="flex items-center space-x-2 mb-4">
              <Bell className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            </div>
            <div className="space-y-4 pl-7">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={tempSettings.notifications.sendReminders}
                  onChange={(e) => updateSettings('notifications', 'sendReminders', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Send reminder emails</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reminder frequency
                </label>
                <select
                  value={tempSettings.notifications.reminderFrequency}
                  onChange={(e) => updateSettings('notifications', 'reminderFrequency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                </select>
              </div>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={tempSettings.notifications.completionNotifications}
                  onChange={(e) => updateSettings('notifications', 'completionNotifications', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Send completion notifications</span>
              </label>
            </div>
          </section>

          {/* Advanced Options */}
          <section>
            <div className="flex items-center space-x-2 mb-4">
              <Users className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Advanced Options</h3>
            </div>
            <div className="space-y-4 pl-7">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={tempSettings.advanced.allowBack}
                  onChange={(e) => updateSettings('advanced', 'allowBack', e.target.value)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Allow navigating back to previous questions</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={tempSettings.advanced.showProgress}
                  onChange={(e) => updateSettings('advanced', 'showProgress', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Show progress indicator</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={tempSettings.advanced.randomizeQuestions}
                  onChange={(e) => updateSettings('advanced', 'randomizeQuestions', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Randomize question order</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={tempSettings.advanced.preventMultipleSubmissions}
                  onChange={(e) => updateSettings('advanced', 'preventMultipleSubmissions', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Prevent multiple submissions</span>
              </label>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveySettingsModal;