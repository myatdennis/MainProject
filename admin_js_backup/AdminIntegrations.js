"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var lucide_react_1 = require("lucide-react");
var AdminIntegrations = function () {
    var _a = (0, react_1.useState)({}), showApiKeys = _a[0], setShowApiKeys = _a[1];
    var _b = (0, react_1.useState)('overview'), activeTab = _b[0], setActiveTab = _b[1];
    var integrations = [
        {
            id: 'mailchimp',
            name: 'Mailchimp',
            description: 'Email marketing and automation',
            category: 'Marketing',
            status: 'connected',
            icon: lucide_react_1.Mail,
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
            icon: lucide_react_1.CreditCard,
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
            icon: lucide_react_1.Users,
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
            icon: lucide_react_1.MessageSquare,
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
            icon: lucide_react_1.Database,
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
            icon: lucide_react_1.BarChart3,
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
            icon: lucide_react_1.Users,
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
            icon: lucide_react_1.Database,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
            lastSync: '2025-03-10 02:30 PM',
            features: ['Contact management', 'Email marketing', 'Sales pipeline'],
            apiKey: 'hub_live_1234567890abcdef',
            webhookUrl: 'https://api.thehuddleco.com/webhooks/hubspot'
        }
    ];
    var webhooks = [
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
    var apiEndpoints = [
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
    var toggleApiKey = function (integrationId) {
        setShowApiKeys(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[integrationId] = !prev[integrationId], _a)));
        });
    };
    var navigate = (0, react_router_dom_1.useNavigate)();
    var handleConfigure = function (id) {
        navigate("/admin/integrations/".concat(id));
    };
    var handleTest = function (name) {
        alert("Testing integration: ".concat(name, " (demo)"));
    };
    var handleRegenerate = function (keyName) {
        alert("Regenerated ".concat(keyName, " (demo)"));
    };
    var handleAddWebhook = function () {
        alert('Open webhook creation modal (demo)');
    };
    var getStatusColor = function (status) {
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
    var getStatusIcon = function (status) {
        switch (status) {
            case 'connected':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-4 w-4 text-green-500" });
            case 'pending':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-4 w-4 text-yellow-500" });
            case 'error':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-4 w-4 text-red-500" });
            default:
                return (0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-4 w-4 text-gray-500" });
        }
    };
    var tabs = [
        { id: 'overview', name: 'Overview', icon: lucide_react_1.Globe },
        { id: 'webhooks', name: 'Webhooks', icon: lucide_react_1.Zap },
        { id: 'api', name: 'API Access', icon: lucide_react_1.Key },
        { id: 'sso', name: 'SSO & Auth', icon: lucide_react_1.Shield }
    ];
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-7xl mx-auto", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Integrations & API" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: "Connect with third-party services and manage API access" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 mb-8", children: [(0, jsx_runtime_1.jsx)("div", { className: "border-b border-gray-200", children: (0, jsx_runtime_1.jsx)("nav", { className: "flex space-x-8 px-6", children: tabs.map(function (tab) {
                                var Icon = tab.icon;
                                return ((0, jsx_runtime_1.jsxs)("button", { onClick: function () { return setActiveTab(tab.id); }, className: "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ".concat(activeTab === tab.id
                                        ? 'border-orange-500 text-orange-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'), children: [(0, jsx_runtime_1.jsx)(Icon, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: tab.name })] }, tab.id));
                            }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [activeTab === 'overview' && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6 mb-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-green-50 p-4 rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-green-600", children: "6" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-green-700", children: "Connected" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-yellow-50 p-4 rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-yellow-600", children: "1" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-yellow-700", children: "Pending" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-red-50 p-4 rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-red-600", children: "1" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-red-700", children: "Error" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-gray-50 p-4 rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-gray-600", children: "1" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-700", children: "Disconnected" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: integrations.map(function (integration) {
                                            var Icon = integration.icon;
                                            return ((0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "p-2 rounded-lg ".concat(integration.bgColor), children: (0, jsx_runtime_1.jsx)(Icon, { className: "h-6 w-6 ".concat(integration.color) }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-gray-900", children: integration.name }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600", children: integration.category })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [getStatusIcon(integration.status), (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getStatusColor(integration.status)), children: integration.status })] })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mb-4", children: integration.description }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 mb-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-500", children: "Features:" }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-1", children: integration.features.map(function (feature, index) { return ((0, jsx_runtime_1.jsx)("span", { className: "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs", children: feature }, index)); }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-gray-500 mb-4", children: ["Last sync: ", integration.lastSync] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleConfigure(integration.id); }, className: "text-sm text-blue-600 hover:text-blue-700 font-medium", children: "Configure" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleTest(integration.name); }, className: "p-1 text-gray-400 hover:text-gray-600", title: "Test", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleConfigure(integration.id); }, className: "p-1 text-gray-400 hover:text-gray-600", title: "Settings", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Settings, { className: "h-4 w-4" }) })] })] })] }, integration.id));
                                        }) })] })), activeTab === 'webhooks' && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-6", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900", children: "Webhook Management" }), (0, jsx_runtime_1.jsxs)("button", { onClick: handleAddWebhook, className: "bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Add Webhook" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: webhooks.map(function (webhook) { return ((0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-gray-900 mb-1", children: webhook.name }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mb-2", children: webhook.url }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: webhook.events.map(function (event, index) { return ((0, jsx_runtime_1.jsx)("span", { className: "bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs", children: event }, index)); }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [getStatusIcon(webhook.status), (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getStatusColor(webhook.status)), children: webhook.status })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Last Triggered:" }), (0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: webhook.lastTriggered })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Success Rate:" }), (0, jsx_runtime_1.jsxs)("div", { className: "font-medium text-gray-900", children: [webhook.successRate, "%"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleTest(webhook.name); }, className: "text-blue-600 hover:text-blue-700", children: "Test" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return alert('Edit webhook (demo)'); }, className: "text-gray-600 hover:text-gray-700", children: "Edit" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { if (confirm('Delete webhook?'))
                                                                        alert('Deleted (demo)'); }, className: "text-red-600 hover:text-red-700", children: "Delete" })] })] })] }, webhook.id)); }) })] })), activeTab === 'api' && ((0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "API Keys" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-2", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-medium text-gray-900", children: "Production API Key" }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return toggleApiKey('production'); }, className: "text-sm text-orange-500 hover:text-orange-600 flex items-center space-x-1", children: [showApiKeys['production'] ? (0, jsx_runtime_1.jsx)(lucide_react_1.EyeOff, { className: "h-4 w-4" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: showApiKeys['production'] ? 'Hide' : 'Show' })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: showApiKeys['production'] ? 'text' : 'password', value: "hc_live_1234567890abcdef1234567890abcdef", readOnly: true, className: "flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono" }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return handleRegenerate('production'); }, className: "bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Regenerate" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-2", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-medium text-gray-900", children: "Test API Key" }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return toggleApiKey('test'); }, className: "text-sm text-orange-500 hover:text-orange-600 flex items-center space-x-1", children: [showApiKeys['test'] ? (0, jsx_runtime_1.jsx)(lucide_react_1.EyeOff, { className: "h-4 w-4" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: showApiKeys['test'] ? 'Hide' : 'Show' })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: showApiKeys['test'] ? 'text' : 'password', value: "hc_test_1234567890abcdef1234567890abcdef", readOnly: true, className: "flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono" }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return handleRegenerate('test'); }, className: "bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200 flex items-center space-x-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Regenerate" })] })] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "API Endpoints" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: apiEndpoints.map(function (endpoint, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3 mb-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded text-xs font-medium ".concat(endpoint.method === 'GET' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'), children: endpoint.method }), (0, jsx_runtime_1.jsx)("code", { className: "text-sm font-mono text-gray-900", children: endpoint.endpoint })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mb-2", children: endpoint.description }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-500", children: endpoint.usage })] }, index)); }) })] })] }) })), activeTab === 'sso' && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Single Sign-On & Authentication" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "SSO Providers" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-blue-50 p-2 rounded-lg", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Shield, { className: "h-5 w-5 text-blue-600" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900", children: "SAML 2.0" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600", children: "Enterprise SSO" })] })] }), (0, jsx_runtime_1.jsx)("span", { className: "bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium", children: "Active" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: [(0, jsx_runtime_1.jsx)("div", { children: "Metadata URL: https://api.thehuddleco.com/saml/metadata" }), (0, jsx_runtime_1.jsx)("div", { children: "ACS URL: https://api.thehuddleco.com/saml/acs" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-green-50 p-2 rounded-lg", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Key, { className: "h-5 w-5 text-green-600" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900", children: "OAuth 2.0" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600", children: "Modern authentication" })] })] }), (0, jsx_runtime_1.jsx)("span", { className: "bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium", children: "Active" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: [(0, jsx_runtime_1.jsx)("div", { children: "Client ID: hc_oauth_1234567890" }), (0, jsx_runtime_1.jsx)("div", { children: "Redirect URI: https://app.thehuddleco.com/auth/callback" })] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Security Settings" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-4 border border-gray-200 rounded-lg", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: "Two-Factor Authentication" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Require 2FA for admin accounts" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "relative inline-flex items-center cursor-pointer", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", defaultChecked: true, className: "sr-only peer" }), (0, jsx_runtime_1.jsx)("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-4 border border-gray-200 rounded-lg", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: "Session Timeout" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Auto-logout after inactivity" })] }), (0, jsx_runtime_1.jsxs)("select", { className: "border border-gray-300 rounded-lg px-3 py-2 text-sm", children: [(0, jsx_runtime_1.jsx)("option", { children: "30 minutes" }), (0, jsx_runtime_1.jsx)("option", { children: "1 hour" }), (0, jsx_runtime_1.jsx)("option", { children: "2 hours" }), (0, jsx_runtime_1.jsx)("option", { children: "4 hours" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-4 border border-gray-200 rounded-lg", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: "IP Restrictions" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Limit access by IP address" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "relative inline-flex items-center cursor-pointer", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", className: "sr-only peer" }), (0, jsx_runtime_1.jsx)("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" })] })] })] })] })] })] }))] })] })] }));
};
exports.default = AdminIntegrations;
