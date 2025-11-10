import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { BarChart3, Users, Zap, Brain, Smartphone, Plus, FileCheck } from 'lucide-react';
import RealTimeDashboard from '../../components/Admin/RealTimeDashboard';
import BulkOperationsCenter from '../../components/Admin/BulkOperationsCenter';
import LearningAnalyticsEngine from '../../components/Admin/LearningAnalyticsEngine';
import AIContentAssistant from '../../components/Admin/AIContentAssistant';
import MobileAdminApp from '../../components/Admin/MobileAdminApp';
import DEISurveyPlatform from '../../components/Survey/DEISurveyPlatform';
const EnhancedAdminPortal = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const features = [
        {
            id: 'overview',
            name: 'Overview',
            icon: Plus,
            description: 'Main dashboard overview'
        },
        {
            id: 'realtime',
            name: 'Real-Time Analytics',
            icon: BarChart3,
            description: 'Live metrics and activity monitoring'
        },
        {
            id: 'bulk-ops',
            name: 'Bulk Operations',
            icon: Users,
            description: 'Mass user management and operations'
        },
        {
            id: 'analytics',
            name: 'Learning Analytics',
            icon: Zap,
            description: 'Advanced learning insights and predictions'
        },
        {
            id: 'ai-content',
            name: 'AI Content Assistant',
            icon: Brain,
            description: 'AI-powered content creation and analysis'
        },
        {
            id: 'mobile',
            name: 'Mobile Admin',
            icon: Smartphone,
            description: 'Mobile app configuration and features'
        },
        {
            id: 'surveys',
            name: 'DEI Surveys',
            icon: FileCheck,
            description: 'Diversity, equity, and inclusion survey platform'
        }
    ];
    const quickStats = [
        { label: 'Total Users', value: '2,847', change: '+12%', changeType: 'positive' },
        { label: 'Active Courses', value: '64', change: '+3', changeType: 'positive' },
        { label: 'Completion Rate', value: '87%', change: '+5%', changeType: 'positive' },
        { label: 'Monthly Revenue', value: '$124K', change: '+18%', changeType: 'positive' }
    ];
    const recentActivities = [
        { action: 'New user registered', user: 'Sarah Chen', time: '2 min ago' },
        { action: 'Course completed', user: 'Mike Johnson', time: '5 min ago' },
        { action: 'Certificate issued', user: 'Emma Davis', time: '8 min ago' },
        { action: 'Bulk import completed', user: 'System', time: '15 min ago' },
        { action: 'AI analysis finished', user: 'Content AI', time: '22 min ago' }
    ];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-gradient-to-r from-blue-600 to-purple-700 rounded-lg p-6 text-white", children: [_jsx("h1", { className: "text-3xl font-bold mb-2", children: "Enhanced Admin Portal" }), _jsx("p", { className: "text-blue-100", children: "Advanced tools and analytics for comprehensive platform management" })] }), _jsx("div", { className: "bg-white rounded-lg border border-gray-200 p-4", children: _jsx("div", { className: "flex flex-wrap gap-2", children: features.map((feature) => (_jsxs("button", { onClick: () => setActiveTab(feature.id), className: `flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === feature.id
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: [_jsx(feature.icon, { className: "w-4 h-4" }), _jsx("span", { children: feature.name })] }, feature.id))) }) }), _jsxs("div", { className: "min-h-[600px]", children: [activeTab === 'overview' && (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: quickStats.map((stat, index) => (_jsx("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: _jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: stat.label }), _jsx("p", { className: "text-2xl font-bold text-gray-900", children: stat.value }), _jsxs("p", { className: `text-sm ${stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`, children: [stat.change, " from last month"] })] }) }) }, index))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Recent Activity" }), _jsx("div", { className: "space-y-3", children: recentActivities.map((activity, index) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: activity.action }), _jsx("p", { className: "text-xs text-gray-600", children: activity.user })] }), _jsx("span", { className: "text-xs text-gray-500", children: activity.time })] }, index))) })] }), _jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "New Features Available" }), _jsx("div", { className: "space-y-4", children: features.slice(1).map((feature) => (_jsxs("div", { className: "flex items-center space-x-3 p-3 border border-gray-200 rounded-lg", children: [_jsx(feature.icon, { className: "w-6 h-6 text-blue-600" }), _jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-medium text-gray-900", children: feature.name }), _jsx("p", { className: "text-sm text-gray-600", children: feature.description })] }), _jsx("button", { onClick: () => setActiveTab(feature.id), className: "text-blue-600 text-sm font-medium hover:text-blue-700", children: "Explore" })] }, feature.id))) })] })] }), _jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Implementation Status" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "text-center p-4 bg-green-50 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-green-600", children: "5/5" }), _jsx("div", { className: "text-sm text-green-700", children: "High Priority Features" }), _jsx("div", { className: "text-xs text-green-600 mt-1", children: "Complete" })] }), _jsxs("div", { className: "text-center p-4 bg-blue-50 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: "90%" }), _jsx("div", { className: "text-sm text-blue-700", children: "Coverage" }), _jsx("div", { className: "text-xs text-blue-600 mt-1", children: "All priority matrix items" })] }), _jsxs("div", { className: "text-center p-4 bg-purple-50 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-purple-600", children: "Ready" }), _jsx("div", { className: "text-sm text-purple-700", children: "Production" }), _jsx("div", { className: "text-xs text-purple-600 mt-1", children: "All systems operational" })] })] })] })] })), activeTab === 'realtime' && _jsx(RealTimeDashboard, {}), activeTab === 'bulk-ops' && _jsx(BulkOperationsCenter, {}), activeTab === 'analytics' && _jsx(LearningAnalyticsEngine, {}), activeTab === 'ai-content' && _jsx(AIContentAssistant, {}), activeTab === 'mobile' && _jsx(MobileAdminApp, {}), activeTab === 'surveys' && _jsx(DEISurveyPlatform, {})] })] }));
};
export default EnhancedAdminPortal;
