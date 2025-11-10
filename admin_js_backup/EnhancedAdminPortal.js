"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var lucide_react_1 = require("lucide-react");
var RealTimeDashboard_1 = require("../../components/Admin/RealTimeDashboard");
var BulkOperationsCenter_1 = require("../../components/Admin/BulkOperationsCenter");
var LearningAnalyticsEngine_1 = require("../../components/Admin/LearningAnalyticsEngine");
var AIContentAssistant_1 = require("../../components/Admin/AIContentAssistant");
var MobileAdminApp_1 = require("../../components/Admin/MobileAdminApp");
var DEISurveyPlatform_1 = require("../../components/Survey/DEISurveyPlatform");
var EnhancedAdminPortal = function () {
    var _a = (0, react_1.useState)('overview'), activeTab = _a[0], setActiveTab = _a[1];
    var features = [
        {
            id: 'overview',
            name: 'Overview',
            icon: lucide_react_1.Plus,
            description: 'Main dashboard overview'
        },
        {
            id: 'realtime',
            name: 'Real-Time Analytics',
            icon: lucide_react_1.BarChart3,
            description: 'Live metrics and activity monitoring'
        },
        {
            id: 'bulk-ops',
            name: 'Bulk Operations',
            icon: lucide_react_1.Users,
            description: 'Mass user management and operations'
        },
        {
            id: 'analytics',
            name: 'Learning Analytics',
            icon: lucide_react_1.Zap,
            description: 'Advanced learning insights and predictions'
        },
        {
            id: 'ai-content',
            name: 'AI Content Assistant',
            icon: lucide_react_1.Brain,
            description: 'AI-powered content creation and analysis'
        },
        {
            id: 'mobile',
            name: 'Mobile Admin',
            icon: lucide_react_1.Smartphone,
            description: 'Mobile app configuration and features'
        },
        {
            id: 'surveys',
            name: 'DEI Surveys',
            icon: lucide_react_1.FileCheck,
            description: 'Diversity, equity, and inclusion survey platform'
        }
    ];
    var quickStats = [
        { label: 'Total Users', value: '2,847', change: '+12%', changeType: 'positive' },
        { label: 'Active Courses', value: '64', change: '+3', changeType: 'positive' },
        { label: 'Completion Rate', value: '87%', change: '+5%', changeType: 'positive' },
        { label: 'Monthly Revenue', value: '$124K', change: '+18%', changeType: 'positive' }
    ];
    var recentActivities = [
        { action: 'New user registered', user: 'Sarah Chen', time: '2 min ago' },
        { action: 'Course completed', user: 'Mike Johnson', time: '5 min ago' },
        { action: 'Certificate issued', user: 'Emma Davis', time: '8 min ago' },
        { action: 'Bulk import completed', user: 'System', time: '15 min ago' },
        { action: 'AI analysis finished', user: 'Content AI', time: '22 min ago' }
    ];
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-gradient-to-r from-blue-600 to-purple-700 rounded-lg p-6 text-white", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold mb-2", children: "Enhanced Admin Portal" }), (0, jsx_runtime_1.jsx)("p", { className: "text-blue-100", children: "Advanced tools and analytics for comprehensive platform management" })] }), (0, jsx_runtime_1.jsx)("div", { className: "bg-white rounded-lg border border-gray-200 p-4", children: (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: features.map(function (feature) { return ((0, jsx_runtime_1.jsxs)("button", { onClick: function () { return setActiveTab(feature.id); }, className: "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ".concat(activeTab === feature.id
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'), children: [(0, jsx_runtime_1.jsx)(feature.icon, { className: "w-4 h-4" }), (0, jsx_runtime_1.jsx)("span", { children: feature.name })] }, feature.id)); }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "min-h-[600px]", children: [activeTab === 'overview' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: quickStats.map(function (stat, index) { return ((0, jsx_runtime_1.jsx)("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: (0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-600", children: stat.label }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-bold text-gray-900", children: stat.value }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm ".concat(stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'), children: [stat.change, " from last month"] })] }) }) }, index)); }) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Recent Activity" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: recentActivities.map(function (activity, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-900", children: activity.action }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-600", children: activity.user })] }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-gray-500", children: activity.time })] }, index)); }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "New Features Available" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: features.slice(1).map(function (feature) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3 p-3 border border-gray-200 rounded-lg", children: [(0, jsx_runtime_1.jsx)(feature.icon, { className: "w-6 h-6 text-blue-600" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900", children: feature.name }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600", children: feature.description })] }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return setActiveTab(feature.id); }, className: "text-blue-600 text-sm font-medium hover:text-blue-700", children: "Explore" })] }, feature.id)); }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Implementation Status" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-center p-4 bg-green-50 rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-green-600", children: "5/5" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-green-700", children: "High Priority Features" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-green-600 mt-1", children: "Complete" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-center p-4 bg-blue-50 rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-blue-600", children: "90%" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-blue-700", children: "Coverage" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-blue-600 mt-1", children: "All priority matrix items" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-center p-4 bg-purple-50 rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-purple-600", children: "Ready" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-purple-700", children: "Production" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-purple-600 mt-1", children: "All systems operational" })] })] })] })] })), activeTab === 'realtime' && (0, jsx_runtime_1.jsx)(RealTimeDashboard_1.default, {}), activeTab === 'bulk-ops' && (0, jsx_runtime_1.jsx)(BulkOperationsCenter_1.default, {}), activeTab === 'analytics' && (0, jsx_runtime_1.jsx)(LearningAnalyticsEngine_1.default, {}), activeTab === 'ai-content' && (0, jsx_runtime_1.jsx)(AIContentAssistant_1.default, {}), activeTab === 'mobile' && (0, jsx_runtime_1.jsx)(MobileAdminApp_1.default, {}), activeTab === 'surveys' && (0, jsx_runtime_1.jsx)(DEISurveyPlatform_1.default, {})] })] }));
};
exports.default = EnhancedAdminPortal;
