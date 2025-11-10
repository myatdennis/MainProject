import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { BarChart3, TrendingUp, Target, Users, Zap, Eye, RefreshCw, CheckCircle, Brain, Lightbulb } from 'lucide-react';
const AdminPerformanceDashboard = () => {
    // ...existing useState declarations...
    function exportDashboardData() {
        try {
            const data = {
                metrics,
                behaviorMetrics,
                optimizationImpacts,
                liveData
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dashboard_export.json';
            a.click();
            toast.success('Dashboard data exported!');
        }
        catch (err) {
            toast.error('Export failed');
        }
    }
    // ...existing useState declarations...
    const [metrics, setMetrics] = useState({
        pageLoadTime: 0.8,
        componentRenderTime: 12,
        apiResponseTime: 150,
        memoryUsage: 45,
        userEngagement: 87,
        errorRate: 0.2,
        cacheHitRate: 94,
        autoSaveSuccessRate: 99.1
    });
    const [behaviorMetrics] = useState({
        sessionDuration: 2400, // 40 minutes
        pagesVisited: 12,
        courseProgress: 68,
        interactionRate: 0.85,
        reflectionLength: 145,
        videoWatchTime: 0.92
    });
    const [optimizationImpacts] = useState([
        { feature: 'Smart Recommendations', improvement: '+15%', metric: 'Course Completion Rate' },
        { feature: 'Auto-save Functionality', improvement: '+99%', metric: 'Data Retention' },
        { feature: 'Video Optimization', improvement: '+25%', metric: 'Watch Time' },
        { feature: 'Engagement Tracking', improvement: '+30%', metric: 'User Insights' },
        { feature: 'Performance Hooks', improvement: '+50%', metric: 'Load Speed' },
        { feature: 'Real-time Sync', improvement: '+80%', metric: 'Data Accuracy' }
    ]);
    const [liveData, setLiveData] = useState({
        activeUsers: 47,
        coursesInProgress: 23,
        autoSavesPerMinute: 12,
        cacheRequests: 156,
        smartRecommendations: 8
    });
    // Simulate real-time updates
    useEffect(() => {
        const interval = setInterval(() => {
            setLiveData(prev => ({
                activeUsers: prev.activeUsers + Math.floor(Math.random() * 3) - 1,
                coursesInProgress: prev.coursesInProgress + Math.floor(Math.random() * 2) - 1,
                autoSavesPerMinute: Math.floor(Math.random() * 20) + 5,
                cacheRequests: prev.cacheRequests + Math.floor(Math.random() * 10) + 1,
                smartRecommendations: prev.smartRecommendations + Math.floor(Math.random() * 2)
            }));
            // Simulate slight metric variations
            setMetrics(prev => ({
                ...prev,
                userEngagement: Math.max(80, Math.min(95, prev.userEngagement + (Math.random() - 0.5) * 2)),
                cacheHitRate: Math.max(90, Math.min(98, prev.cacheHitRate + (Math.random() - 0.5) * 1)),
                autoSaveSuccessRate: Math.max(98, Math.min(100, prev.autoSaveSuccessRate + (Math.random() - 0.5) * 0.5))
            }));
        }, 5000);
        return () => clearInterval(interval);
    }, []);
    const getMetricColor = (value, good, excellent) => {
        if (value >= excellent)
            return 'text-green-600';
        if (value >= good)
            return 'text-yellow-600';
        return 'text-red-600';
    };
    const getMetricBgColor = (value, good, excellent) => {
        if (value >= excellent)
            return 'bg-green-50 border-green-200';
        if (value >= good)
            return 'bg-yellow-50 border-yellow-200';
        return 'bg-red-50 border-red-200';
    };
    return (_jsxs("div", { className: "p-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Performance Optimization Dashboard" }), _jsx("p", { className: "text-gray-600", children: "Real-time monitoring of platform performance improvements" })] }), _jsx("div", { className: "mb-6 flex justify-end", children: _jsx("button", { className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700", onClick: exportDashboardData, children: "Export Data" }) }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-5 gap-6 mb-8", children: [
                    { label: 'Active Users', value: liveData.activeUsers, icon: Users, color: 'text-blue-600' },
                    { label: 'Courses Active', value: liveData.coursesInProgress, icon: BarChart3, color: 'text-green-600' },
                    { label: 'Auto-saves/min', value: liveData.autoSavesPerMinute, icon: RefreshCw, color: 'text-orange-600' },
                    { label: 'Cache Hits', value: liveData.cacheRequests, icon: Zap, color: 'text-purple-600' },
                    { label: 'AI Recommendations', value: liveData.smartRecommendations, icon: Brain, color: 'text-indigo-600' }
                ].map((stat, index) => (_jsx("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600 mb-1", children: stat.label }), _jsx("p", { className: `text-2xl font-bold ${stat.color}`, children: stat.value })] }), _jsx(stat.icon, { className: `h-8 w-8 ${stat.color}` })] }) }, index))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsxs("h2", { className: "text-xl font-bold text-gray-900 mb-6 flex items-center", children: [_jsx(TrendingUp, { className: "h-6 w-6 mr-2 text-green-500" }), "System Performance"] }), _jsx("div", { className: "space-y-4", children: [
                                    { label: 'Page Load Time', value: `${metrics.pageLoadTime}s`, good: 1.5, excellent: 1.0, current: metrics.pageLoadTime },
                                    { label: 'Component Render', value: `${metrics.componentRenderTime}ms`, good: 50, excellent: 20, current: metrics.componentRenderTime },
                                    { label: 'API Response', value: `${metrics.apiResponseTime}ms`, good: 500, excellent: 200, current: metrics.apiResponseTime },
                                    { label: 'Memory Usage', value: `${metrics.memoryUsage}%`, good: 70, excellent: 50, current: metrics.memoryUsage },
                                ].map((metric, index) => (_jsx("div", { className: `p-4 rounded-lg border ${getMetricBgColor(metric.current <= 100 ? 100 - metric.current : metric.current, metric.good, metric.excellent)}`, children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "font-medium text-gray-900", children: metric.label }), _jsx("span", { className: `font-bold ${getMetricColor(metric.current <= 100 ? 100 - metric.current : metric.current, metric.good, metric.excellent)}`, children: metric.value })] }) }, index))) })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsxs("h2", { className: "text-xl font-bold text-gray-900 mb-6 flex items-center", children: [_jsx(Target, { className: "h-6 w-6 mr-2 text-blue-500" }), "User Experience"] }), _jsx("div", { className: "space-y-4", children: [
                                    { label: 'User Engagement', value: `${Math.round(metrics.userEngagement)}%`, target: 85 },
                                    { label: 'Cache Hit Rate', value: `${Math.round(metrics.cacheHitRate)}%`, target: 90 },
                                    { label: 'Auto-save Success', value: `${metrics.autoSaveSuccessRate}%`, target: 98 },
                                    { label: 'Error Rate', value: `${metrics.errorRate}%`, target: 1 },
                                ].map((metric, index) => (_jsxs("div", { className: "p-4 rounded-lg bg-gray-50 border border-gray-200", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("span", { className: "font-medium text-gray-900", children: metric.label }), _jsx("span", { className: "font-bold text-blue-600", children: metric.value })] }), _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "bg-gradient-to-r from-blue-400 to-blue-500 h-2 rounded-full", style: { width: `${Math.min(100, parseFloat(metric.value))}%` } }) })] }, index))) })] })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8", children: [_jsxs("h2", { className: "text-xl font-bold text-gray-900 mb-6 flex items-center", children: [_jsx(Lightbulb, { className: "h-6 w-6 mr-2 text-yellow-500" }), "Optimization Impact Analysis"] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: optimizationImpacts.map((impact, index) => (_jsxs("div", { className: "bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200", children: [_jsx("h3", { className: "font-semibold text-green-900 mb-2", children: impact.feature }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-green-700", children: impact.metric }), _jsx("span", { className: "font-bold text-green-600 text-lg", children: impact.improvement })] })] }, index))) })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsxs("h2", { className: "text-xl font-bold text-gray-900 mb-6 flex items-center", children: [_jsx(Eye, { className: "h-6 w-6 mr-2 text-purple-500" }), "User Behavior Analytics"] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "font-semibold text-gray-900", children: "Engagement Metrics" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Avg Session Duration" }), _jsxs("span", { className: "font-medium", children: [Math.round(behaviorMetrics.sessionDuration / 60), " min"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Interaction Rate" }), _jsxs("span", { className: "font-medium", children: [Math.round(behaviorMetrics.interactionRate * 100), "%"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Video Completion" }), _jsxs("span", { className: "font-medium", children: [Math.round(behaviorMetrics.videoWatchTime * 100), "%"] })] })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "font-semibold text-gray-900", children: "Learning Progress" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Course Progress" }), _jsxs("span", { className: "font-medium", children: [behaviorMetrics.courseProgress, "%"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Pages per Session" }), _jsx("span", { className: "font-medium", children: behaviorMetrics.pagesVisited })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Avg Reflection Length" }), _jsxs("span", { className: "font-medium", children: [behaviorMetrics.reflectionLength, " chars"] })] })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "font-semibold text-gray-900", children: "Performance Impact" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center text-green-600", children: [_jsx(CheckCircle, { className: "h-4 w-4 mr-2" }), _jsx("span", { className: "text-sm", children: "50% faster loading" })] }), _jsxs("div", { className: "flex items-center text-green-600", children: [_jsx(CheckCircle, { className: "h-4 w-4 mr-2" }), _jsx("span", { className: "text-sm", children: "99% auto-save success" })] }), _jsxs("div", { className: "flex items-center text-green-600", children: [_jsx(CheckCircle, { className: "h-4 w-4 mr-2" }), _jsx("span", { className: "text-sm", children: "Real-time progress sync" })] })] })] })] })] })] }));
};
export default AdminPerformanceDashboard;
