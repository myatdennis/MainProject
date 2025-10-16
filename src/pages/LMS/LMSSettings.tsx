import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Bell, 
  Shield, 
  Globe, 
  Volume2, 
  VolumeX,
  Save,
  ArrowLeft 
} from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import NotificationPreferencesForm from '../../components/notifications/NotificationPreferencesForm';

interface UserSettings {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    timezone: string;
    language: string;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email: boolean;
      push: boolean;
      courseReminders: boolean;
      completionNotifications: boolean;
      weeklyProgress: boolean;
    };
    privacy: {
      profileVisible: boolean;
      progressVisible: boolean;
      achievementsVisible: boolean;
    };
    accessibility: {
      soundEnabled: boolean;
      animationsEnabled: boolean;
      highContrast: boolean;
      fontSize: 'small' | 'medium' | 'large';
    };
  };
}

const LMSSettings: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  
  const [settings, setSettings] = useState<UserSettings>({
    profile: {
      firstName: user?.name?.split(' ')[0] || '',
      lastName: user?.name?.split(' ')[1] || '',
      email: user?.email || '',
      phone: '',
      timezone: 'America/New_York',
      language: 'en'
    },
    preferences: {
      theme: 'light',
      notifications: {
        email: true,
        push: true,
        courseReminders: true,
        completionNotifications: true,
        weeklyProgress: false
      },
      privacy: {
        profileVisible: true,
        progressVisible: true,
        achievementsVisible: true
      },
      accessibility: {
        soundEnabled: true,
        animationsEnabled: true,
        highContrast: false,
        fontSize: 'medium'
      }
    }
  });

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'privacy' | 'accessibility'>('profile');

  useEffect(() => {
    // Load user settings from API or localStorage
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      // Mock loading settings - replace with actual API call
      const savedSettings = localStorage.getItem('lms-user-settings');
      if (savedSettings) {
        setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Mock save - replace with actual API call
      localStorage.setItem('lms-user-settings', JSON.stringify(settings));
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showToast('Settings saved successfully!', 'success');
    } catch (error) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateProfileField = (field: keyof UserSettings['profile'], value: string) => {
    setSettings(prev => ({
      ...prev,
      profile: { ...prev.profile, [field]: value }
    }));
  };

  const updateNotificationSetting = (setting: keyof UserSettings['preferences']['notifications'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        notifications: { ...prev.preferences.notifications, [setting]: value }
      }
    }));
  };

  const updatePrivacySetting = (setting: keyof UserSettings['preferences']['privacy'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        privacy: { ...prev.preferences.privacy, [setting]: value }
      }
    }));
  };

  const updateAccessibilitySetting = (setting: keyof UserSettings['preferences']['accessibility'], value: any) => {
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        accessibility: { ...prev.preferences.accessibility, [setting]: value }
      }
    }));
  };

  const timezones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo'
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' }
  ];

  return (
    <>
      <SEO 
        title="Settings - Learning Platform"
        description="Customize your learning experience and account preferences"
        keywords={['settings', 'preferences', 'profile', 'notifications', 'privacy']}
      />
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate('/lms/dashboard')}
                  className="flex items-center text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Dashboard
                </button>
                <h1 className="text-xl font-bold text-gray-900">Settings</h1>
              </div>
              
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="lg:grid lg:grid-cols-4 lg:gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <nav className="space-y-1">
                  {[
                    { key: 'profile', label: 'Profile', icon: User },
                    { key: 'notifications', label: 'Notifications', icon: Bell },
                    { key: 'privacy', label: 'Privacy', icon: Shield },
                    { key: 'accessibility', label: 'Accessibility', icon: Globe }
                  ].map(section => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.key}
                        onClick={() => setActiveSection(section.key as any)}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                          activeSection === section.key
                            ? 'bg-orange-100 text-orange-600'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="h-4 w-4 mr-3" />
                        {section.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 mt-8 lg:mt-0">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Profile Settings */}
                {activeSection === 'profile' && (
                  <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-6">Profile Information</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={settings.profile.firstName}
                          onChange={(e) => updateProfileField('firstName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={settings.profile.lastName}
                          onChange={(e) => updateProfileField('lastName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={settings.profile.email}
                          onChange={(e) => updateProfileField('email', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={settings.profile.phone}
                          onChange={(e) => updateProfileField('phone', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Timezone
                        </label>
                        <select
                          value={settings.profile.timezone}
                          onChange={(e) => updateProfileField('timezone', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        >
                          {timezones.map(tz => (
                            <option key={tz} value={tz}>{tz}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Language
                        </label>
                        <select
                          value={settings.profile.language}
                          onChange={(e) => updateProfileField('language', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        >
                          {languages.map(lang => (
                            <option key={lang.code} value={lang.code}>{lang.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notification Settings */}
                {activeSection === 'notifications' && (
                  <div className="p-6">
                    <NotificationPreferencesForm />
                  </div>
                )}

                {/* Privacy Settings */}
                {activeSection === 'privacy' && (
                  <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-6">Privacy Settings</h2>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-700">Profile Visibility</h3>
                          <p className="text-xs text-gray-500">Allow others to see your profile information</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.preferences.privacy.profileVisible}
                            onChange={(e) => updatePrivacySetting('profileVisible', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-700">Progress Visibility</h3>
                          <p className="text-xs text-gray-500">Show your learning progress to others</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.preferences.privacy.progressVisible}
                            onChange={(e) => updatePrivacySetting('progressVisible', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-700">Achievement Visibility</h3>
                          <p className="text-xs text-gray-500">Display your achievements and certificates</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.preferences.privacy.achievementsVisible}
                            onChange={(e) => updatePrivacySetting('achievementsVisible', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Accessibility Settings */}
                {activeSection === 'accessibility' && (
                  <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-6">Accessibility Preferences</h2>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-700">Sound Effects</h3>
                          <p className="text-xs text-gray-500">Play sounds for notifications and interactions</p>
                        </div>
                        <button
                          onClick={() => updateAccessibilitySetting('soundEnabled', !settings.preferences.accessibility.soundEnabled)}
                          className="flex items-center text-gray-600 hover:text-gray-900"
                        >
                          {settings.preferences.accessibility.soundEnabled ? (
                            <Volume2 className="h-5 w-5" />
                          ) : (
                            <VolumeX className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-700">Animations</h3>
                          <p className="text-xs text-gray-500">Enable interface animations and transitions</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.preferences.accessibility.animationsEnabled}
                            onChange={(e) => updateAccessibilitySetting('animationsEnabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-700">High Contrast</h3>
                          <p className="text-xs text-gray-500">Use high contrast colors for better visibility</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.preferences.accessibility.highContrast}
                            onChange={(e) => updateAccessibilitySetting('highContrast', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Font Size
                        </label>
                        <select
                          value={settings.preferences.accessibility.fontSize}
                          onChange={(e) => updateAccessibilitySetting('fontSize', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LMSSettings;