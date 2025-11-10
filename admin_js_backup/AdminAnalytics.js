"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var lucide_react_1 = require("lucide-react");
var Breadcrumbs_1 = require("../../components/ui/Breadcrumbs");
var AdminAnalytics = function () {
    var _a = (0, react_1.useState)('last-30-days'), dateRange = _a[0], setDateRange = _a[1];
    var _b = (0, react_1.useState)('engagement'), selectedMetric = _b[0], setSelectedMetric = _b[1];
    var refreshAnalytics = function () {
        console.log('Refreshing analytics...');
        alert('Analytics refreshed (demo)');
    };
    var exportInsights = function () {
        var data = { exportedAt: new Date().toISOString(), metric: selectedMetric };
        var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        var a = document.createElement('a');
        a.setAttribute('href', dataStr);
        a.setAttribute('download', "insights-".concat(selectedMetric, "-").concat(Date.now(), ".json"));
        document.body.appendChild(a);
        a.click();
        a.remove();
    };
    var applySuggestion = function (title) {
        alert("".concat(title, " applied (demo)"));
    };
    var scheduleNow = function (title) {
        alert("".concat(title, " scheduled (demo)"));
    };
    var createGroup = function (title) {
        alert("".concat(title, " group created (demo)"));
    };
    var aiInsights = [
        {
            type: 'warning',
            title: 'At-Risk Learners Detected',
            description: '23 learners are predicted to drop out based on engagement patterns',
            confidence: 87,
            action: 'Send targeted interventions',
            icon: lucide_react_1.AlertTriangle,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-50',
            borderColor: 'border-yellow-200'
        },
        {
            type: 'success',
            title: 'High-Performing Module Identified',
            description: '"Empathy in Action" shows 95% completion with excellent feedback',
            confidence: 94,
            action: 'Replicate format in other modules',
            icon: lucide_react_1.Target,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200'
        },
        {
            type: 'info',
            title: 'Optimal Learning Time Discovered',
            description: 'Learners are 40% more engaged between 10-11 AM on Tuesdays',
            confidence: 82,
            action: 'Schedule live sessions accordingly',
            icon: lucide_react_1.Clock,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200'
        }
    ];
    var predictiveMetrics = [
        { label: 'Completion Probability', value: '78%', trend: '+5%', color: 'text-green-600' },
        { label: 'Dropout Risk', value: '12%', trend: '-3%', color: 'text-red-600' },
        { label: 'Engagement Score', value: '8.4/10', trend: '+0.7', color: 'text-blue-600' },
        { label: 'Content Effectiveness', value: '85%', trend: '+12%', color: 'text-purple-600' }
    ];
    var engagementHeatmap = [
        { day: 'Mon', hours: [2, 5, 8, 12, 15, 18, 14, 10, 6, 3, 1, 0] },
        { day: 'Tue', hours: [1, 4, 9, 15, 22, 28, 25, 18, 12, 7, 3, 1] },
        { day: 'Wed', hours: [3, 6, 11, 18, 24, 30, 27, 20, 14, 8, 4, 2] },
        { day: 'Thu', hours: [2, 7, 13, 20, 26, 32, 29, 22, 16, 9, 5, 2] },
        { day: 'Fri', hours: [4, 8, 14, 21, 25, 28, 24, 17, 11, 6, 3, 1] },
        { day: 'Sat', hours: [1, 3, 6, 9, 12, 15, 13, 10, 7, 4, 2, 1] },
        { day: 'Sun', hours: [0, 2, 4, 7, 10, 13, 11, 8, 5, 3, 1, 0] }
    ];
    var learnerJourney = [
        { stage: 'Enrollment', users: 247, conversion: 100, avgTime: '0 days' },
        { stage: 'First Login', users: 234, conversion: 95, avgTime: '1.2 days' },
        { stage: 'Module 1 Start', users: 221, conversion: 89, avgTime: '2.8 days' },
        { stage: 'Module 1 Complete', users: 198, conversion: 80, avgTime: '5.4 days' },
        { stage: 'Module 2 Start', users: 189, conversion: 77, avgTime: '7.1 days' },
        { stage: 'Module 3 Complete', users: 156, conversion: 63, avgTime: '14.2 days' },
        { stage: 'Certification', users: 142, conversion: 58, avgTime: '21.5 days' }
    ];
    var contentPerformance = [
        {
            content: 'Foundations Video 1',
            views: 234,
            completion: 89,
            avgWatchTime: '12:34',
            engagement: 'High',
            feedback: 4.8
        },
        {
            content: 'Bias Recognition Quiz',
            views: 198,
            completion: 76,
            avgWatchTime: '8:45',
            engagement: 'Medium',
            feedback: 4.2
        },
        {
            content: 'Empathy Case Study',
            views: 189,
            completion: 92,
            avgWatchTime: '15:22',
            engagement: 'High',
            feedback: 4.9
        },
        {
            content: 'Conversation Template',
            views: 156,
            completion: 68,
            avgWatchTime: '6:12',
            engagement: 'Low',
            feedback: 3.8
        }
    ];
    var getEngagementColor = function (engagement) {
        switch (engagement) {
            case 'High':
                return 'bg-green-100 text-green-800';
            case 'Medium':
                return 'bg-yellow-100 text-yellow-800';
            case 'Low':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    var getHeatmapColor = function (value) {
        if (value === 0)
            return 'bg-gray-100';
        if (value <= 5)
            return 'bg-blue-100';
        if (value <= 10)
            return 'bg-blue-200';
        if (value <= 15)
            return 'bg-blue-300';
        if (value <= 20)
            return 'bg-blue-400';
        if (value <= 25)
            return 'bg-blue-500';
        return 'bg-blue-600';
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-6", children: (0, jsx_runtime_1.jsx)(Breadcrumbs_1.default, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Analytics', to: '/admin/analytics' }] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Advanced Analytics & AI Insights" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: "AI-powered analytics to optimize learning experiences and predict outcomes" })] }), (0, jsx_runtime_1.jsx)("div", { className: "card-lg card-hover mb-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Calendar, { className: "h-5 w-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("select", { value: dateRange, onChange: function (e) { return setDateRange(e.target.value); }, className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "last-7-days", children: "Last 7 Days" }), (0, jsx_runtime_1.jsx)("option", { value: "last-30-days", children: "Last 30 Days" }), (0, jsx_runtime_1.jsx)("option", { value: "last-90-days", children: "Last 90 Days" }), (0, jsx_runtime_1.jsx)("option", { value: "last-year", children: "Last Year" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Filter, { className: "h-5 w-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("select", { value: selectedMetric, onChange: function (e) { return setSelectedMetric(e.target.value); }, className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "engagement", children: "Engagement Analysis" }), (0, jsx_runtime_1.jsx)("option", { value: "performance", children: "Performance Metrics" }), (0, jsx_runtime_1.jsx)("option", { value: "predictive", children: "Predictive Analytics" }), (0, jsx_runtime_1.jsx)("option", { value: "content", children: "Content Analysis" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4", children: [(0, jsx_runtime_1.jsxs)("button", { onClick: refreshAnalytics, className: "flex items-center space-x-2 text-gray-600 hover:text-gray-900 font-medium", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Refresh AI Analysis" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: exportInsights, className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Export Insights" })] })] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2 mb-6", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "h-6 w-6 text-purple-500" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900", children: "AI-Powered Insights" })] }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: aiInsights.map(function (insight, index) {
                            var Icon = insight.icon;
                            return ((0, jsx_runtime_1.jsx)("div", { className: "p-6 rounded-lg border ".concat(insight.borderColor, " ").concat(insight.bgColor), children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start space-x-3 mb-4", children: [(0, jsx_runtime_1.jsx)(Icon, { className: "h-6 w-6 ".concat(insight.color, " mt-0.5") }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold text-gray-900 mb-1", children: insight.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mb-3", children: insight.description }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-gray-500", children: ["Confidence: ", insight.confidence, "%"] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return applySuggestion(insight.title); }, className: "text-sm font-medium ".concat(insight.color, " hover:underline"), children: [insight.action, " \u2192"] })] })] })] }) }, index));
                        }) })] }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: predictiveMetrics.map(function (metric, index) { return ((0, jsx_runtime_1.jsx)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-600", children: metric.label }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: metric.value }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center mt-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium ".concat(metric.color), children: metric.trend }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-500 ml-1", children: "vs last period" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "p-3 rounded-lg bg-purple-50", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "h-6 w-6 text-purple-500" }) })] }) }, index)); }) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "card-lg", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Engagement Heatmap" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-13 gap-1 text-xs text-gray-500 mb-2", children: [(0, jsx_runtime_1.jsx)("div", {}), Array.from({ length: 12 }, function (_, i) { return ((0, jsx_runtime_1.jsx)("div", { className: "text-center", children: i === 0 ? '12a' : i < 12 ? "".concat(i, "a") : '12p' }, i)); })] }), engagementHeatmap.map(function (day, dayIndex) { return ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-13 gap-1", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-500 py-1", children: day.day }), day.hours.map(function (value, hourIndex) { return ((0, jsx_runtime_1.jsx)("div", { className: "h-4 rounded-sm ".concat(getHeatmapColor(value)), title: "".concat(day.day, " ").concat(hourIndex, ":00 - ").concat(value, " active learners") }, hourIndex)); })] }, dayIndex)); })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mt-4 text-xs text-gray-500", children: [(0, jsx_runtime_1.jsx)("span", { children: "Less active" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-1", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-3 h-3 bg-gray-100 rounded-sm" }), (0, jsx_runtime_1.jsx)("div", { className: "w-3 h-3 bg-blue-100 rounded-sm" }), (0, jsx_runtime_1.jsx)("div", { className: "w-3 h-3 bg-blue-300 rounded-sm" }), (0, jsx_runtime_1.jsx)("div", { className: "w-3 h-3 bg-blue-500 rounded-sm" }), (0, jsx_runtime_1.jsx)("div", { className: "w-3 h-3 bg-blue-600 rounded-sm" })] }), (0, jsx_runtime_1.jsx)("span", { children: "More active" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Learner Journey Analysis" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: learnerJourney.map(function (stage, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-3 border border-gray-200 rounded-lg", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: stage.stage }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: [stage.users, " users \u2022 Avg: ", stage.avgTime] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-lg font-bold text-gray-900", children: [stage.conversion, "%"] }), (0, jsx_runtime_1.jsx)("div", { className: "w-16 bg-gray-200 rounded-full h-2 mt-1", children: (0, jsx_runtime_1.jsx)("div", { className: "h-2 rounded-full", style: { width: "".concat(stage.conversion, "%"), background: 'var(--gradient-blue-green)' } }) })] })] }, index)); }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg mb-8", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Content Performance Analysis" }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-gray-50", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "text-left py-3 px-4 font-semibold text-gray-900", children: "Content" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Views" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Completion" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Avg. Time" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Engagement" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Rating" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: contentPerformance.map(function (content, index) { return ((0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-gray-100 hover:bg-gray-50", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4", children: (0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: content.content }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4 text-center", children: (0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: content.views }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4 text-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "font-medium text-gray-900", children: [content.completion, "%"] }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4 text-center text-gray-600", children: content.avgWatchTime }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4 text-center", children: (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getEngagementColor(content.engagement)), children: content.engagement }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4 text-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center space-x-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium text-gray-900", children: content.feedback }), (0, jsx_runtime_1.jsx)("div", { className: "text-yellow-400", children: "\u2605" })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4 text-center", children: (0, jsx_runtime_1.jsx)("button", { className: "p-1 text-blue-600 hover:text-blue-800", title: "View Details", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }) })] }, index)); }) })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl p-8", style: { background: 'var(--gradient-banner)' }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3 mb-6", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Zap, { className: "h-6 w-6 text-purple-500" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900", children: "AI Recommendations" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-4 rounded-lg shadow-sm", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold text-gray-900 mb-2", children: "Optimize Content" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mb-3", children: "Break down \"Conversation Template\" into smaller, interactive segments to improve engagement." }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return applySuggestion('Optimize Content'); }, className: "text-sm text-purple-600 hover:text-purple-700 font-medium", children: "Apply Suggestion \u2192" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-4 rounded-lg shadow-sm", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold text-gray-900 mb-2", children: "Schedule Reminders" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mb-3", children: "Send personalized reminders to 23 at-risk learners on Tuesday mornings for optimal engagement." }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return scheduleNow('Schedule Reminders'); }, className: "text-sm text-purple-600 hover:text-purple-700 font-medium", children: "Schedule Now \u2192" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-4 rounded-lg shadow-sm", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold text-gray-900 mb-2", children: "Create Cohort" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mb-3", children: "Group high-performing learners for peer mentoring to boost overall completion rates." }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return createGroup('Create Cohort'); }, className: "text-sm text-purple-600 hover:text-purple-700 font-medium", children: "Create Group \u2192" })] })] })] })] }));
};
exports.default = AdminAnalytics;
