import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, Shield, Globe, Volume2, VolumeX, Save, ArrowLeft } from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
const LMSSettings = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [settings, setSettings] = useState({
        profile: {
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
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
    const [activeSection, setActiveSection] = useState('profile');
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
        }
        catch (error) {
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
        }
        catch (error) {
            showToast('Failed to save settings', 'error');
        }
        finally {
            setSaving(false);
        }
    };
    const updateProfileField = (field, value) => {
        setSettings(prev => ({
            ...prev,
            profile: { ...prev.profile, [field]: value }
        }));
    };
    const updateNotificationSetting = (setting, value) => {
        setSettings(prev => ({
            ...prev,
            preferences: {
                ...prev.preferences,
                notifications: { ...prev.preferences.notifications, [setting]: value }
            }
        }));
    };
    const updatePrivacySetting = (setting, value) => {
        setSettings(prev => ({
            ...prev,
            preferences: {
                ...prev.preferences,
                privacy: { ...prev.preferences.privacy, [setting]: value }
            }
        }));
    };
    const updateAccessibilitySetting = (setting, value) => {
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
    return (_jsxs(_Fragment, { children: [_jsx(SEO, { title: "Settings - Learning Platform", description: "Customize your learning experience and account preferences", keywords: ['settings', 'preferences', 'profile', 'notifications', 'privacy'] }), _jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("div", { className: "bg-white border-b border-gray-200", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex items-center justify-between h-16", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("button", { onClick: () => navigate('/lms/dashboard'), className: "flex items-center text-gray-600 hover:text-gray-900", children: [_jsx(ArrowLeft, { className: "h-5 w-5 mr-2" }), "Back to Dashboard"] }), _jsx("h1", { className: "text-xl font-bold text-gray-900", children: "Settings" })] }), _jsxs("button", { onClick: saveSettings, disabled: saving, className: "flex items-center px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50", children: [_jsx(Save, { className: "h-4 w-4 mr-2" }), saving ? 'Saving...' : 'Save Changes'] })] }) }) }), _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: _jsxs("div", { className: "lg:grid lg:grid-cols-4 lg:gap-8", children: [_jsx("div", { className: "lg:col-span-1", children: _jsx("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200 p-4", children: _jsx("nav", { className: "space-y-1", children: [
                                                { key: 'profile', label: 'Profile', icon: User },
                                                { key: 'notifications', label: 'Notifications', icon: Bell },
                                                { key: 'privacy', label: 'Privacy', icon: Shield },
                                                { key: 'accessibility', label: 'Accessibility', icon: Globe }
                                            ].map(section => {
                                                const Icon = section.icon;
                                                return (_jsxs("button", { onClick: () => setActiveSection(section.key), className: `w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${activeSection === section.key
                                                        ? 'bg-orange-100 text-orange-600'
                                                        : 'text-gray-600 hover:bg-gray-50'}`, children: [_jsx(Icon, { className: "h-4 w-4 mr-3" }), section.label] }, section.key));
                                            }) }) }) }), _jsx("div", { className: "lg:col-span-3 mt-8 lg:mt-0", children: _jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200", children: [activeSection === 'profile' && (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-lg font-medium text-gray-900 mb-6", children: "Profile Information" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "First Name" }), _jsx("input", { type: "text", value: settings.profile.firstName, onChange: (e) => updateProfileField('firstName', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Last Name" }), _jsx("input", { type: "text", value: settings.profile.lastName, onChange: (e) => updateProfileField('lastName', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Email" }), _jsx("input", { type: "email", value: settings.profile.email, onChange: (e) => updateProfileField('email', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Phone" }), _jsx("input", { type: "tel", value: settings.profile.phone, onChange: (e) => updateProfileField('phone', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Timezone" }), _jsx("select", { value: settings.profile.timezone, onChange: (e) => updateProfileField('timezone', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: timezones.map(tz => (_jsx("option", { value: tz, children: tz }, tz))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Language" }), _jsx("select", { value: settings.profile.language, onChange: (e) => updateProfileField('language', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: languages.map(lang => (_jsx("option", { value: lang.code, children: lang.name }, lang.code))) })] })] })] })), activeSection === 'notifications' && (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-lg font-medium text-gray-900 mb-6", children: "Notification Preferences" }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Email Notifications" }), _jsx("p", { className: "text-xs text-gray-500", children: "Receive notifications via email" })] }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.preferences.notifications.email, onChange: (e) => updateNotificationSetting('email', e.target.checked), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Course Reminders" }), _jsx("p", { className: "text-xs text-gray-500", children: "Get reminders about upcoming courses" })] }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.preferences.notifications.courseReminders, onChange: (e) => updateNotificationSetting('courseReminders', e.target.checked), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Completion Notifications" }), _jsx("p", { className: "text-xs text-gray-500", children: "Celebrate when you complete courses" })] }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.preferences.notifications.completionNotifications, onChange: (e) => updateNotificationSetting('completionNotifications', e.target.checked), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Weekly Progress Reports" }), _jsx("p", { className: "text-xs text-gray-500", children: "Receive weekly summaries of your learning progress" })] }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.preferences.notifications.weeklyProgress, onChange: (e) => updateNotificationSetting('weeklyProgress', e.target.checked), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] })] })] })), activeSection === 'privacy' && (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-lg font-medium text-gray-900 mb-6", children: "Privacy Settings" }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Profile Visibility" }), _jsx("p", { className: "text-xs text-gray-500", children: "Allow others to see your profile information" })] }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.preferences.privacy.profileVisible, onChange: (e) => updatePrivacySetting('profileVisible', e.target.checked), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Progress Visibility" }), _jsx("p", { className: "text-xs text-gray-500", children: "Show your learning progress to others" })] }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.preferences.privacy.progressVisible, onChange: (e) => updatePrivacySetting('progressVisible', e.target.checked), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Achievement Visibility" }), _jsx("p", { className: "text-xs text-gray-500", children: "Display your achievements and certificates" })] }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.preferences.privacy.achievementsVisible, onChange: (e) => updatePrivacySetting('achievementsVisible', e.target.checked), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] })] })] })), activeSection === 'accessibility' && (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-lg font-medium text-gray-900 mb-6", children: "Accessibility Preferences" }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Sound Effects" }), _jsx("p", { className: "text-xs text-gray-500", children: "Play sounds for notifications and interactions" })] }), _jsx("button", { onClick: () => updateAccessibilitySetting('soundEnabled', !settings.preferences.accessibility.soundEnabled), className: "flex items-center text-gray-600 hover:text-gray-900", children: settings.preferences.accessibility.soundEnabled ? (_jsx(Volume2, { className: "h-5 w-5" })) : (_jsx(VolumeX, { className: "h-5 w-5" })) })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Animations" }), _jsx("p", { className: "text-xs text-gray-500", children: "Enable interface animations and transitions" })] }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.preferences.accessibility.animationsEnabled, onChange: (e) => updateAccessibilitySetting('animationsEnabled', e.target.checked), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "High Contrast" }), _jsx("p", { className: "text-xs text-gray-500", children: "Use high contrast colors for better visibility" })] }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: settings.preferences.accessibility.highContrast, onChange: (e) => updateAccessibilitySetting('highContrast', e.target.checked), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Font Size" }), _jsxs("select", { value: settings.preferences.accessibility.fontSize, onChange: (e) => updateAccessibilitySetting('fontSize', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "small", children: "Small" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "large", children: "Large" })] })] })] })] }))] }) })] }) })] })] }));
};
export default LMSSettings;
