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
var react_hot_toast_1 = require("react-hot-toast");
var lucide_react_1 = require("lucide-react");
var AdminPerformanceDashboard = function () {
    // ...existing useState declarations...
    function exportDashboardData() {
        try {
            var data = {
                metrics: metrics,
                behaviorMetrics: behaviorMetrics,
                optimizationImpacts: optimizationImpacts,
                liveData: liveData
            };
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'dashboard_export.json';
            a.click();
            react_hot_toast_1.default.success('Dashboard data exported!');
        }
        catch (err) {
            react_hot_toast_1.default.error('Export failed');
        }
    }
    // ...existing useState declarations...
    var _a = (0, react_1.useState)({
        pageLoadTime: 0.8,
        componentRenderTime: 12,
        apiResponseTime: 150,
        memoryUsage: 45,
        userEngagement: 87,
        errorRate: 0.2,
        cacheHitRate: 94,
        autoSaveSuccessRate: 99.1
    }), metrics = _a[0], setMetrics = _a[1];
    var behaviorMetrics = (0, react_1.useState)({
        sessionDuration: 2400, // 40 minutes
        pagesVisited: 12,
        courseProgress: 68,
        interactionRate: 0.85,
        reflectionLength: 145,
        videoWatchTime: 0.92
    })[0];
    var optimizationImpacts = (0, react_1.useState)([
        { feature: 'Smart Recommendations', improvement: '+15%', metric: 'Course Completion Rate' },
        { feature: 'Auto-save Functionality', improvement: '+99%', metric: 'Data Retention' },
        { feature: 'Video Optimization', improvement: '+25%', metric: 'Watch Time' },
        { feature: 'Engagement Tracking', improvement: '+30%', metric: 'User Insights' },
        { feature: 'Performance Hooks', improvement: '+50%', metric: 'Load Speed' },
        { feature: 'Real-time Sync', improvement: '+80%', metric: 'Data Accuracy' }
    ])[0];
    var _b = (0, react_1.useState)({
        activeUsers: 47,
        coursesInProgress: 23,
        autoSavesPerMinute: 12,
        cacheRequests: 156,
        smartRecommendations: 8
    }), liveData = _b[0], setLiveData = _b[1];
    // Simulate real-time updates
    (0, react_1.useEffect)(function () {
        var interval = setInterval(function () {
            setLiveData(function (prev) { return ({
                activeUsers: prev.activeUsers + Math.floor(Math.random() * 3) - 1,
                coursesInProgress: prev.coursesInProgress + Math.floor(Math.random() * 2) - 1,
                autoSavesPerMinute: Math.floor(Math.random() * 20) + 5,
                cacheRequests: prev.cacheRequests + Math.floor(Math.random() * 10) + 1,
                smartRecommendations: prev.smartRecommendations + Math.floor(Math.random() * 2)
            }); });
            // Simulate slight metric variations
            setMetrics(function (prev) { return (__assign(__assign({}, prev), { userEngagement: Math.max(80, Math.min(95, prev.userEngagement + (Math.random() - 0.5) * 2)), cacheHitRate: Math.max(90, Math.min(98, prev.cacheHitRate + (Math.random() - 0.5) * 1)), autoSaveSuccessRate: Math.max(98, Math.min(100, prev.autoSaveSuccessRate + (Math.random() - 0.5) * 0.5)) })); });
        }, 5000);
        return function () { return clearInterval(interval); };
    }, []);
    var getMetricColor = function (value, good, excellent) {
        if (value >= excellent)
            return 'text-green-600';
        if (value >= good)
            return 'text-yellow-600';
        return 'text-red-600';
    };
    var getMetricBgColor = function (value, good, excellent) {
        if (value >= excellent)
            return 'bg-green-50 border-green-200';
        if (value >= good)
            return 'bg-yellow-50 border-yellow-200';
        return 'bg-red-50 border-red-200';
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-7xl mx-auto", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Performance Optimization Dashboard" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: "Real-time monitoring of platform performance improvements" })] }), (0, jsx_runtime_1.jsx)("div", { className: "mb-6 flex justify-end", children: (0, jsx_runtime_1.jsx)("button", { className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700", onClick: exportDashboardData, children: "Export Data" }) }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-5 gap-6 mb-8", children: [
                    { label: 'Active Users', value: liveData.activeUsers, icon: lucide_react_1.Users, color: 'text-blue-600' },
                    { label: 'Courses Active', value: liveData.coursesInProgress, icon: lucide_react_1.BarChart3, color: 'text-green-600' },
                    { label: 'Auto-saves/min', value: liveData.autoSavesPerMinute, icon: lucide_react_1.RefreshCw, color: 'text-orange-600' },
                    { label: 'Cache Hits', value: liveData.cacheRequests, icon: lucide_react_1.Zap, color: 'text-purple-600' },
                    { label: 'AI Recommendations', value: liveData.smartRecommendations, icon: lucide_react_1.Brain, color: 'text-indigo-600' }
                ].map(function (stat, index) { return ((0, jsx_runtime_1.jsx)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mb-1", children: stat.label }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-bold ".concat(stat.color), children: stat.value })] }), (0, jsx_runtime_1.jsx)(stat.icon, { className: "h-8 w-8 ".concat(stat.color) })] }) }, index)); }) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsxs)("h2", { className: "text-xl font-bold text-gray-900 mb-6 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.TrendingUp, { className: "h-6 w-6 mr-2 text-green-500" }), "System Performance"] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: [
                                    { label: 'Page Load Time', value: "".concat(metrics.pageLoadTime, "s"), good: 1.5, excellent: 1.0, current: metrics.pageLoadTime },
                                    { label: 'Component Render', value: "".concat(metrics.componentRenderTime, "ms"), good: 50, excellent: 20, current: metrics.componentRenderTime },
                                    { label: 'API Response', value: "".concat(metrics.apiResponseTime, "ms"), good: 500, excellent: 200, current: metrics.apiResponseTime },
                                    { label: 'Memory Usage', value: "".concat(metrics.memoryUsage, "%"), good: 70, excellent: 50, current: metrics.memoryUsage },
                                ].map(function (metric, index) { return ((0, jsx_runtime_1.jsx)("div", { className: "p-4 rounded-lg border ".concat(getMetricBgColor(metric.current <= 100 ? 100 - metric.current : metric.current, metric.good, metric.excellent)), children: (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium text-gray-900", children: metric.label }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold ".concat(getMetricColor(metric.current <= 100 ? 100 - metric.current : metric.current, metric.good, metric.excellent)), children: metric.value })] }) }, index)); }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsxs)("h2", { className: "text-xl font-bold text-gray-900 mb-6 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Target, { className: "h-6 w-6 mr-2 text-blue-500" }), "User Experience"] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: [
                                    { label: 'User Engagement', value: "".concat(Math.round(metrics.userEngagement), "%"), target: 85 },
                                    { label: 'Cache Hit Rate', value: "".concat(Math.round(metrics.cacheHitRate), "%"), target: 90 },
                                    { label: 'Auto-save Success', value: "".concat(metrics.autoSaveSuccessRate, "%"), target: 98 },
                                    { label: 'Error Rate', value: "".concat(metrics.errorRate, "%"), target: 1 },
                                ].map(function (metric, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "p-4 rounded-lg bg-gray-50 border border-gray-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center mb-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium text-gray-900", children: metric.label }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold text-blue-600", children: metric.value })] }), (0, jsx_runtime_1.jsx)("div", { className: "w-full bg-gray-200 rounded-full h-2", children: (0, jsx_runtime_1.jsx)("div", { className: "bg-gradient-to-r from-blue-400 to-blue-500 h-2 rounded-full", style: { width: "".concat(Math.min(100, parseFloat(metric.value)), "%") } }) })] }, index)); }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8", children: [(0, jsx_runtime_1.jsxs)("h2", { className: "text-xl font-bold text-gray-900 mb-6 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Lightbulb, { className: "h-6 w-6 mr-2 text-yellow-500" }), "Optimization Impact Analysis"] }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: optimizationImpacts.map(function (impact, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold text-green-900 mb-2", children: impact.feature }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-green-700", children: impact.metric }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold text-green-600 text-lg", children: impact.improvement })] })] }, index)); }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsxs)("h2", { className: "text-xl font-bold text-gray-900 mb-6 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-6 w-6 mr-2 text-purple-500" }), "User Behavior Analytics"] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold text-gray-900", children: "Engagement Metrics" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Avg Session Duration" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium", children: [Math.round(behaviorMetrics.sessionDuration / 60), " min"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Interaction Rate" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium", children: [Math.round(behaviorMetrics.interactionRate * 100), "%"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Video Completion" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium", children: [Math.round(behaviorMetrics.videoWatchTime * 100), "%"] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold text-gray-900", children: "Learning Progress" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Course Progress" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium", children: [behaviorMetrics.courseProgress, "%"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Pages per Session" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: behaviorMetrics.pagesVisited })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Avg Reflection Length" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium", children: [behaviorMetrics.reflectionLength, " chars"] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold text-gray-900", children: "Performance Impact" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center text-green-600", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-4 w-4 mr-2" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "50% faster loading" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center text-green-600", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-4 w-4 mr-2" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "99% auto-save success" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center text-green-600", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-4 w-4 mr-2" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Real-time progress sync" })] })] })] })] })] })] }));
};
exports.default = AdminPerformanceDashboard;
