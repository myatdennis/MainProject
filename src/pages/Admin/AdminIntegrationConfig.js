import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Zap, RefreshCw, Eye, EyeOff, Shield, Key, Globe, AlertCircle, CheckCircle } from 'lucide-react';
import LoadingButton from '../../components/LoadingButton';
import { useToast } from '../../context/ToastContext';
const AdminIntegrationConfig = () => {
    const { integrationId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    // Mock integration data - in real app, this would come from an API
    const getIntegrationData = (id) => {
        const integrations = {
            mailchimp: {
                id: 'mailchimp',
                name: 'Mailchimp',
                description: 'Email marketing and automation platform',
                status: 'connected',
                apiKey: 'mc_live_1234567890abcdef',
                webhookUrl: 'https://api.thehuddleco.com/webhooks/mailchimp',
                settings: {
                    listId: 'abc123def456',
                    automationEnabled: true,
                    doubleOptIn: true,
                    tagNewSubscribers: true,
                    defaultTags: 'huddle-learner,inclusive-leadership'
                }
            },
            stripe: {
                id: 'stripe',
                name: 'Stripe',
                description: 'Payment processing and billing',
                status: 'connected',
                apiKey: 'sk_live_1234567890abcdef',
                webhookUrl: 'https://api.thehuddleco.com/webhooks/stripe',
                settings: {
                    publicKey: 'pk_live_1234567890abcdef',
                    currency: 'USD',
                    collectTaxes: true,
                    invoiceReminders: true,
                    trialPeriod: 14
                }
            },
            zoom: {
                id: 'zoom',
                name: 'Zoom',
                description: 'Video conferencing and webinars',
                status: 'connected',
                apiKey: 'zoom_jwt_1234567890abcdef',
                settings: {
                    accountId: 'zoom_account_123',
                    autoRecord: true,
                    waitingRoom: true,
                    defaultDuration: 60,
                    allowScreenShare: true
                }
            },
            slack: {
                id: 'slack',
                name: 'Slack',
                description: 'Team communication and notifications',
                status: 'connected',
                apiKey: 'xoxb-1234567890-abcdef',
                webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
                settings: {
                    channel: '#general',
                    notifyCompletions: true,
                    notifyEnrollments: true,
                    mentionUsers: false,
                    quietHours: true
                }
            }
        };
        return integrations[id] || {
            id: id,
            name: id.charAt(0).toUpperCase() + id.slice(1),
            description: `${id.charAt(0).toUpperCase() + id.slice(1)} integration`,
            status: 'disconnected',
            settings: {}
        };
    };
    const [config, setConfig] = useState(getIntegrationData(integrationId || ''));
    const handleSave = async () => {
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            showToast(`${config.name} configuration saved successfully!`, 'success');
        }
        catch (error) {
            showToast('Failed to save configuration. Please try again.', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const handleTest = async () => {
        setTesting(true);
        try {
            // Simulate connection test
            await new Promise(resolve => setTimeout(resolve, 3000));
            showToast(`${config.name} connection test successful!`, 'success');
        }
        catch (error) {
            showToast('Connection test failed. Please check your settings.', 'error');
        }
        finally {
            setTesting(false);
        }
    };
    const handleRegenerateApiKey = async () => {
        setLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const newApiKey = `${config.apiKey?.split('_')[0]}_live_${Math.random().toString(36).substring(7)}`;
            setConfig(prev => ({ ...prev, apiKey: newApiKey }));
            showToast('API key regenerated successfully!', 'success');
        }
        catch (error) {
            showToast('Failed to regenerate API key.', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const updateSetting = (key, value) => {
        setConfig(prev => ({
            ...prev,
            settings: { ...prev.settings, [key]: value }
        }));
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'connected':
                return _jsx(CheckCircle, { className: "h-5 w-5 text-green-500" });
            default:
                return _jsx(AlertCircle, { className: "h-5 w-5 text-red-500" });
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'connected':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-red-100 text-red-800';
        }
    };
    if (!integrationId) {
        return _jsx("div", { children: "Integration not found" });
    }
    return (_jsxs("div", { className: "p-6 max-w-4xl mx-auto", children: [_jsx("div", { className: "mb-8", children: _jsxs("div", { className: "flex items-center space-x-4 mb-4", children: [_jsx("button", { onClick: () => navigate('/admin/integrations'), className: "p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors", title: "Back to Integrations", children: _jsx(ArrowLeft, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("h1", { className: "text-3xl font-bold text-gray-900", children: [config.name, " Configuration"] }), _jsxs("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(config.status)} flex items-center space-x-1`, children: [getStatusIcon(config.status), _jsx("span", { children: config.status })] })] }), _jsx("p", { className: "text-gray-600 mt-1", children: config.description })] }), _jsx("div", { className: "flex items-center space-x-2", children: _jsxs(LoadingButton, { onClick: handleTest, loading: testing, variant: "secondary", children: [_jsx(Zap, { className: "h-4 w-4" }), "Test Connection"] }) })] }) }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [_jsx(Key, { className: "h-5 w-5 text-gray-600" }), _jsx("span", { children: "API Configuration" })] }), _jsxs("div", { className: "space-y-4", children: [config.apiKey && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "API Key" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx("input", { type: showApiKey ? 'text' : 'password', value: config.apiKey, onChange: (e) => setConfig(prev => ({ ...prev, apiKey: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("button", { type: "button", onClick: () => setShowApiKey(!showApiKey), className: "absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600", children: showApiKey ? _jsx(EyeOff, { className: "h-4 w-4" }) : _jsx(Eye, { className: "h-4 w-4" }) })] }), _jsxs("button", { onClick: handleRegenerateApiKey, disabled: loading, className: "px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center space-x-1", children: [_jsx(RefreshCw, { className: "h-3 w-3" }), _jsx("span", { children: "Regenerate" })] })] })] })), config.webhookUrl && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Webhook URL" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Globe, { className: "h-4 w-4 text-gray-400" }), _jsx("input", { type: "url", value: config.webhookUrl, onChange: (e) => setConfig(prev => ({ ...prev, webhookUrl: e.target.value })), className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }))] })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [_jsx(Shield, { className: "h-5 w-5 text-gray-600" }), _jsx("span", { children: "Settings" })] }), _jsx("div", { className: "space-y-4", children: Object.entries(config.settings).map(([key, value]) => (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()) }), typeof value === 'boolean' ? (_jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", checked: value, onChange: (e) => updateSetting(key, e.target.checked), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("span", { className: "ml-2 text-sm text-gray-600", children: value ? 'Enabled' : 'Disabled' })] })) : typeof value === 'number' ? (_jsx("input", { type: "number", value: value, onChange: (e) => updateSetting(key, parseInt(e.target.value) || 0), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })) : (_jsx("input", { type: "text", value: value, onChange: (e) => updateSetting(key, e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }))] }, key))) })] }), _jsxs("div", { className: "flex items-center justify-end space-x-4 pt-6 border-t border-gray-200", children: [_jsx("button", { onClick: () => navigate('/admin/integrations'), className: "px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200", disabled: loading || testing, children: "Cancel" }), _jsxs(LoadingButton, { onClick: handleSave, loading: loading, variant: "primary", children: [_jsx(Save, { className: "h-4 w-4" }), "Save Configuration"] })] })] })] }));
};
export default AdminIntegrationConfig;
