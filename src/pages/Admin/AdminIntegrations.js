import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, CheckCircle, AlertTriangle, Settings, Plus, Eye, EyeOff, RefreshCw, Database, Mail, CreditCard, Users, BarChart3, MessageSquare, Globe, Shield, Key } from 'lucide-react';
const AdminIntegrations = () => {
    const [showApiKeys, setShowApiKeys] = useState({});
    const [activeTab, setActiveTab] = useState('overview');
    const integrations = [
        {
            id: 'mailchimp',
            name: 'Mailchimp',
            description: 'Email marketing and automation',
            category: 'Marketing',
            status: 'connected',
            icon: Mail,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-50',
            lastSync: '2025-03-11 10:30 AM',
            features: ['Email campaigns', 'Subscriber management', 'Automation workflows'],
            apiKey: 'mc_live_1234567890abcdef',
            webhookUrl: 'https://api.thehuddleco.com/webhooks/mailchimp'
        },
        {
            id: 'stripe',
            name: 'Stripe',
            description: 'Payment processing and billing',
            category: 'Payments',
            status: 'connected',
            icon: CreditCard,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            lastSync: '2025-03-11 09:15 AM',
            features: ['Payment processing', 'Subscription billing', 'Invoice generation'],
            apiKey: 'sk_live_1234567890abcdef',
            webhookUrl: 'https://api.thehuddleco.com/webhooks/stripe'
        },
        {
            id: 'zoom',
            name: 'Zoom',
            description: 'Video conferencing and webinars',
            category: 'Communication',
            status: 'connected',
            icon: Users,
            color: 'text-blue-500',
            bgColor: 'bg-blue-50',
            lastSync: '2025-03-11 08:45 AM',
            features: ['Meeting scheduling', 'Webinar hosting', 'Recording management'],
            apiKey: 'zoom_jwt_1234567890abcdef',
            webhookUrl: 'https://api.thehuddleco.com/webhooks/zoom'
        },
        {
            id: 'slack',
            name: 'Slack',
            description: 'Team communication and notifications',
            category: 'Communication',
            status: 'connected',
            icon: MessageSquare,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            lastSync: '2025-03-11 11:00 AM',
            features: ['Notifications', 'Team updates', 'Progress alerts'],
            apiKey: 'xoxb-1234567890-abcdef',
            webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'
        },
        {
            id: 'salesforce',
            name: 'Salesforce',
            description: 'Customer relationship management',
            category: 'CRM',
            status: 'pending',
            icon: Database,
            color: 'text-blue-700',
            bgColor: 'bg-blue-50',
            lastSync: 'Never',
            features: ['Contact sync', 'Lead management', 'Opportunity tracking'],
            apiKey: '',
            webhookUrl: ''
        },
        {
            id: 'google-analytics',
            name: 'Google Analytics',
            description: 'Website and learning analytics',
            category: 'Analytics',
            status: 'connected',
            icon: BarChart3,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
            lastSync: '2025-03-11 10:00 AM',
            features: ['User tracking', 'Engagement metrics', 'Conversion analysis'],
            apiKey: 'GA4-XXXXXXXXX-X',
            webhookUrl: 'https://api.thehuddleco.com/webhooks/google-analytics'
        },
        {
            id: 'microsoft-teams',
            name: 'Microsoft Teams',
            description: 'Enterprise communication platform',
            category: 'Communication',
            status: 'disconnected',
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            lastSync: '2025-02-15 03:20 PM',
            features: ['Team meetings', 'File sharing', 'Collaboration'],
            apiKey: '',
            webhookUrl: ''
        },
        {
            id: 'hubspot',
            name: 'HubSpot',
            description: 'Marketing and sales automation',
            category: 'CRM',
            status: 'error',
            icon: Database,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
            lastSync: '2025-03-10 02:30 PM',
            features: ['Contact management', 'Email marketing', 'Sales pipeline'],
            apiKey: 'hub_live_1234567890abcdef',
            webhookUrl: 'https://api.thehuddleco.com/webhooks/hubspot'
        }
    ];
    const webhooks = [
        {
            id: '1',
            name: 'Course Completion Webhook',
            url: 'https://api.client-org.com/webhooks/completion',
            events: ['course.completed', 'certificate.issued'],
            status: 'active',
            lastTriggered: '2025-03-11 10:45 AM',
            successRate: 98.5
        },
        {
            id: '2',
            name: 'User Progress Webhook',
            url: 'https://api.university.edu/lms/progress',
            events: ['user.progress', 'module.started'],
            status: 'active',
            lastTriggered: '2025-03-11 09:30 AM',
            successRate: 99.2
        },
        {
            id: '3',
            name: 'Enrollment Webhook',
            url: 'https://api.nonprofit.org/training/enroll',
            events: ['user.enrolled', 'cohort.created'],
            status: 'error',
            lastTriggered: '2025-03-10 04:15 PM',
            successRate: 85.3
        }
    ];
    const apiEndpoints = [
        {
            method: 'GET',
            endpoint: '/api/v1/users',
            description: 'Retrieve user list with progress data',
            usage: '1,234 calls/month'
        },
        {
            method: 'POST',
            endpoint: '/api/v1/users/{id}/enroll',
            description: 'Enroll user in specific course',
            usage: '567 calls/month'
        },
        {
            method: 'GET',
            endpoint: '/api/v1/courses/{id}/progress',
            description: 'Get course completion statistics',
            usage: '890 calls/month'
        },
        {
            method: 'POST',
            endpoint: '/api/v1/certificates/issue',
            description: 'Issue certificate to user',
            usage: '234 calls/month'
        }
    ];
    const toggleApiKey = (integrationId) => {
        setShowApiKeys(prev => ({
            ...prev,
            [integrationId]: !prev[integrationId]
        }));
    };
    const navigate = useNavigate();
    const handleConfigure = (id) => {
        navigate(`/admin/integrations/${id}`);
    };
    const handleTest = (name) => {
        alert(`Testing integration: ${name} (demo)`);
    };
    const handleRegenerate = (keyName) => {
        alert(`Regenerated ${keyName} (demo)`);
    };
    const handleAddWebhook = () => {
        alert('Open webhook creation modal (demo)');
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'connected':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'error':
                return 'bg-red-100 text-red-800';
            case 'disconnected':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'connected':
                return _jsx(CheckCircle, { className: "h-4 w-4 text-green-500" });
            case 'pending':
                return _jsx(RefreshCw, { className: "h-4 w-4 text-yellow-500" });
            case 'error':
                return _jsx(AlertTriangle, { className: "h-4 w-4 text-red-500" });
            default:
                return _jsx(AlertTriangle, { className: "h-4 w-4 text-gray-500" });
        }
    };
    const tabs = [
        { id: 'overview', name: 'Overview', icon: Globe },
        { id: 'webhooks', name: 'Webhooks', icon: Zap },
        { id: 'api', name: 'API Access', icon: Key },
        { id: 'sso', name: 'SSO & Auth', icon: Shield }
    ];
    return (_jsxs("div", { className: "p-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Integrations & API" }), _jsx("p", { className: "text-gray-600", children: "Connect with third-party services and manage API access" })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 mb-8", children: [_jsx("div", { className: "border-b border-gray-200", children: _jsx("nav", { className: "flex space-x-8 px-6", children: tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                        ? 'border-orange-500 text-orange-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: [_jsx(Icon, { className: "h-4 w-4" }), _jsx("span", { children: tab.name })] }, tab.id));
                            }) }) }), _jsxs("div", { className: "p-6", children: [activeTab === 'overview' && (_jsxs("div", { children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6 mb-8", children: [_jsxs("div", { className: "bg-green-50 p-4 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-green-600", children: "6" }), _jsx("div", { className: "text-sm text-green-700", children: "Connected" })] }), _jsxs("div", { className: "bg-yellow-50 p-4 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-yellow-600", children: "1" }), _jsx("div", { className: "text-sm text-yellow-700", children: "Pending" })] }), _jsxs("div", { className: "bg-red-50 p-4 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-red-600", children: "1" }), _jsx("div", { className: "text-sm text-red-700", children: "Error" })] }), _jsxs("div", { className: "bg-gray-50 p-4 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-gray-600", children: "1" }), _jsx("div", { className: "text-sm text-gray-700", children: "Disconnected" })] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: integrations.map((integration) => {
                                            const Icon = integration.icon;
                                            return (_jsxs("div", { className: "border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-200", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: `p-2 rounded-lg ${integration.bgColor}`, children: _jsx(Icon, { className: `h-6 w-6 ${integration.color}` }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-gray-900", children: integration.name }), _jsx("p", { className: "text-sm text-gray-600", children: integration.category })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [getStatusIcon(integration.status), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(integration.status)}`, children: integration.status })] })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: integration.description }), _jsxs("div", { className: "space-y-2 mb-4", children: [_jsx("div", { className: "text-xs text-gray-500", children: "Features:" }), _jsx("div", { className: "flex flex-wrap gap-1", children: integration.features.map((feature, index) => (_jsx("span", { className: "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs", children: feature }, index))) })] }), _jsxs("div", { className: "text-xs text-gray-500 mb-4", children: ["Last sync: ", integration.lastSync] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("button", { onClick: () => handleConfigure(integration.id), className: "text-sm text-blue-600 hover:text-blue-700 font-medium", children: "Configure" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => handleTest(integration.name), className: "p-1 text-gray-400 hover:text-gray-600", title: "Test", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => handleConfigure(integration.id), className: "p-1 text-gray-400 hover:text-gray-600", title: "Settings", children: _jsx(Settings, { className: "h-4 w-4" }) })] })] })] }, integration.id));
                                        }) })] })), activeTab === 'webhooks' && (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900", children: "Webhook Management" }), _jsxs("button", { onClick: handleAddWebhook, className: "bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Plus, { className: "h-4 w-4" }), _jsx("span", { children: "Add Webhook" })] })] }), _jsx("div", { className: "space-y-4", children: webhooks.map((webhook) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-bold text-gray-900 mb-1", children: webhook.name }), _jsx("p", { className: "text-sm text-gray-600 mb-2", children: webhook.url }), _jsx("div", { className: "flex flex-wrap gap-2", children: webhook.events.map((event, index) => (_jsx("span", { className: "bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs", children: event }, index))) })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [getStatusIcon(webhook.status), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(webhook.status)}`, children: webhook.status })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-gray-600", children: "Last Triggered:" }), _jsx("div", { className: "font-medium text-gray-900", children: webhook.lastTriggered })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-600", children: "Success Rate:" }), _jsxs("div", { className: "font-medium text-gray-900", children: [webhook.successRate, "%"] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => handleTest(webhook.name), className: "text-blue-600 hover:text-blue-700", children: "Test" }), _jsx("button", { onClick: () => alert('Edit webhook (demo)'), className: "text-gray-600 hover:text-gray-700", children: "Edit" }), _jsx("button", { onClick: () => { if (confirm('Delete webhook?'))
                                                                        alert('Deleted (demo)'); }, className: "text-red-600 hover:text-red-700", children: "Delete" })] })] })] }, webhook.id))) })] })), activeTab === 'api' && (_jsx("div", { children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "API Keys" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h3", { className: "font-medium text-gray-900", children: "Production API Key" }), _jsxs("button", { onClick: () => toggleApiKey('production'), className: "text-sm text-orange-500 hover:text-orange-600 flex items-center space-x-1", children: [showApiKeys['production'] ? _jsx(EyeOff, { className: "h-4 w-4" }) : _jsx(Eye, { className: "h-4 w-4" }), _jsx("span", { children: showApiKeys['production'] ? 'Hide' : 'Show' })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: showApiKeys['production'] ? 'text' : 'password', value: "hc_live_1234567890abcdef1234567890abcdef", readOnly: true, className: "flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono" }), _jsxs("button", { onClick: () => handleRegenerate('production'), className: "bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-1", children: [_jsx(RefreshCw, { className: "h-4 w-4" }), _jsx("span", { children: "Regenerate" })] })] })] }), _jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h3", { className: "font-medium text-gray-900", children: "Test API Key" }), _jsxs("button", { onClick: () => toggleApiKey('test'), className: "text-sm text-orange-500 hover:text-orange-600 flex items-center space-x-1", children: [showApiKeys['test'] ? _jsx(EyeOff, { className: "h-4 w-4" }) : _jsx(Eye, { className: "h-4 w-4" }), _jsx("span", { children: showApiKeys['test'] ? 'Hide' : 'Show' })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: showApiKeys['test'] ? 'text' : 'password', value: "hc_test_1234567890abcdef1234567890abcdef", readOnly: true, className: "flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono" }), _jsxs("button", { onClick: () => handleRegenerate('test'), className: "bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200 flex items-center space-x-1", children: [_jsx(RefreshCw, { className: "h-4 w-4" }), _jsx("span", { children: "Regenerate" })] })] })] })] })] }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "API Endpoints" }), _jsx("div", { className: "space-y-3", children: apiEndpoints.map((endpoint, index) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center space-x-3 mb-2", children: [_jsx("span", { className: `px-2 py-1 rounded text-xs font-medium ${endpoint.method === 'GET' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`, children: endpoint.method }), _jsx("code", { className: "text-sm font-mono text-gray-900", children: endpoint.endpoint })] }), _jsx("p", { className: "text-sm text-gray-600 mb-2", children: endpoint.description }), _jsx("div", { className: "text-xs text-gray-500", children: endpoint.usage })] }, index))) })] })] }) })), activeTab === 'sso' && (_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Single Sign-On & Authentication" }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "SSO Providers" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "bg-blue-50 p-2 rounded-lg", children: _jsx(Shield, { className: "h-5 w-5 text-blue-600" }) }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900", children: "SAML 2.0" }), _jsx("p", { className: "text-sm text-gray-600", children: "Enterprise SSO" })] })] }), _jsx("span", { className: "bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium", children: "Active" })] }), _jsxs("div", { className: "text-sm text-gray-600", children: [_jsx("div", { children: "Metadata URL: https://api.thehuddleco.com/saml/metadata" }), _jsx("div", { children: "ACS URL: https://api.thehuddleco.com/saml/acs" })] })] }), _jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "bg-green-50 p-2 rounded-lg", children: _jsx(Key, { className: "h-5 w-5 text-green-600" }) }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900", children: "OAuth 2.0" }), _jsx("p", { className: "text-sm text-gray-600", children: "Modern authentication" })] })] }), _jsx("span", { className: "bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium", children: "Active" })] }), _jsxs("div", { className: "text-sm text-gray-600", children: [_jsx("div", { children: "Client ID: hc_oauth_1234567890" }), _jsx("div", { children: "Redirect URI: https://app.thehuddleco.com/auth/callback" })] })] })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Security Settings" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border border-gray-200 rounded-lg", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: "Two-Factor Authentication" }), _jsx("div", { className: "text-sm text-gray-600", children: "Require 2FA for admin accounts" })] }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", defaultChecked: true, className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] }), _jsxs("div", { className: "flex items-center justify-between p-4 border border-gray-200 rounded-lg", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: "Session Timeout" }), _jsx("div", { className: "text-sm text-gray-600", children: "Auto-logout after inactivity" })] }), _jsxs("select", { className: "border border-gray-300 rounded-lg px-3 py-2 text-sm", children: [_jsx("option", { children: "30 minutes" }), _jsx("option", { children: "1 hour" }), _jsx("option", { children: "2 hours" }), _jsx("option", { children: "4 hours" })] })] }), _jsxs("div", { className: "flex items-center justify-between p-4 border border-gray-200 rounded-lg", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: "IP Restrictions" }), _jsx("div", { className: "text-sm text-gray-600", children: "Limit access by IP address" })] }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] })] })] })] })] }))] })] })] }));
};
export default AdminIntegrations;
