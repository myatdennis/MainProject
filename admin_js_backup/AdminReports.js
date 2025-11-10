"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var lucide_react_1 = require("lucide-react");
var Breadcrumbs_1 = require("../../components/ui/Breadcrumbs");
var ToastContext_1 = require("../../context/ToastContext");
var AdminReports = function () {
    var _a = (0, react_1.useState)('last-30-days'), dateRange = _a[0], setDateRange = _a[1];
    var _b = (0, react_1.useState)('overview'), reportType = _b[0], setReportType = _b[1];
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var refreshReports = function () {
        console.log('Refreshing reports...');
        showToast('Reports refreshed', 'success');
    };
    var exportReport = function () {
        var data = { exportedAt: new Date().toISOString(), reportType: reportType };
        var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        var a = document.createElement('a');
        a.setAttribute('href', dataStr);
        a.setAttribute('download', "report-".concat(reportType, "-").concat(Date.now(), ".json"));
        document.body.appendChild(a);
        a.click();
        a.remove();
    };
    var generateNewReport = function () {
        showToast('Generating report…', 'info');
    };
    var viewReport = function (name) {
        window.open("/admin/report-preview?name=".concat(encodeURIComponent(name)), '_blank');
    };
    var downloadReport = function (name) {
        var text = "Report: ".concat(name, "\nGenerated: ").concat(new Date().toLocaleString());
        var blob = new Blob([text], { type: 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = "".concat(name.replace(/\s+/g, '_').toLowerCase(), ".txt");
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };
    var shareReport = function (name) {
        var _a;
        var link = "".concat(window.location.origin, "/admin/reports?shared=").concat(encodeURIComponent(name));
        (_a = navigator.clipboard) === null || _a === void 0 ? void 0 : _a.writeText(link).then(function () { return showToast('Report link copied to clipboard', 'success'); }).catch(function () { return showToast('Copy not supported', 'error'); });
    };
    var overviewStats = [
        { label: 'Total Learners', value: '247', change: '+12%', changeType: 'positive' },
        { label: 'Course Completions', value: '1,234', change: '+8%', changeType: 'positive' },
        { label: 'Avg. Completion Time', value: '3.2 days', change: '-15%', changeType: 'positive' },
        { label: 'Satisfaction Score', value: '4.8/5', change: '+0.2', changeType: 'positive' }
    ];
    var modulePerformance = [
        { name: 'Foundations of Inclusive Leadership', enrollments: 247, completions: 198, rate: 80, avgTime: '45 min', rating: 4.9 },
        { name: 'Empathy in Action', enrollments: 156, completions: 124, rate: 79, avgTime: '38 min', rating: 4.9 },
        { name: 'Recognizing and Mitigating Bias', enrollments: 189, completions: 142, rate: 75, avgTime: '58 min', rating: 4.8 },
        { name: 'Personal & Team Action Planning', enrollments: 98, completions: 67, rate: 68, avgTime: '35 min', rating: 4.7 },
        { name: 'Courageous Conversations at Work', enrollments: 45, completions: 23, rate: 51, avgTime: '52 min', rating: 4.6 }
    ];
    var organizationPerformance = [
        { name: 'Pacific Coast University', learners: 45, completion: 94, engagement: 'High', lastActivity: '2025-03-11' },
        { name: 'Community Impact Network', learners: 28, completion: 91, engagement: 'High', lastActivity: '2025-03-10' },
        { name: 'Regional Medical Center', learners: 67, completion: 89, engagement: 'Medium', lastActivity: '2025-03-11' },
        { name: 'Mountain View High School', learners: 23, completion: 87, engagement: 'High', lastActivity: '2025-03-09' },
        { name: 'TechForward Solutions', learners: 34, completion: 85, engagement: 'High', lastActivity: '2025-03-11' }
    ];
    var engagementData = [
        { day: 'Mon', logins: 45, completions: 12, feedback: 8 },
        { day: 'Tue', logins: 52, completions: 18, feedback: 11 },
        { day: 'Wed', logins: 38, completions: 15, feedback: 9 },
        { day: 'Thu', logins: 61, completions: 22, feedback: 14 },
        { day: 'Fri', logins: 43, completions: 16, feedback: 7 },
        { day: 'Sat', logins: 28, completions: 8, feedback: 3 },
        { day: 'Sun', logins: 31, completions: 9, feedback: 4 }
    ];
    var feedbackSummary = [
        { category: 'Content Quality', score: 4.8, responses: 156, trend: '+0.2' },
        { category: 'Ease of Use', score: 4.6, responses: 142, trend: '+0.1' },
        { category: 'Relevance', score: 4.9, responses: 168, trend: '+0.3' },
        { category: 'Support Quality', score: 4.7, responses: 89, trend: '+0.1' }
    ];
    var reports = [
        {
            name: 'Monthly Progress Report',
            description: 'Comprehensive overview of learner progress and completion rates',
            lastGenerated: '2025-03-01',
            format: 'PDF',
            size: '2.3 MB'
        },
        {
            name: 'Organization Performance',
            description: 'Detailed breakdown by organization with engagement metrics',
            lastGenerated: '2025-03-01',
            format: 'Excel',
            size: '1.8 MB'
        },
        {
            name: 'Course Analytics',
            description: 'Module-by-module analysis with completion and feedback data',
            lastGenerated: '2025-02-28',
            format: 'PDF',
            size: '3.1 MB'
        },
        {
            name: 'Learner Engagement',
            description: 'Daily and weekly engagement patterns and trends',
            lastGenerated: '2025-02-28',
            format: 'Excel',
            size: '1.2 MB'
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-6", children: (0, jsx_runtime_1.jsx)(Breadcrumbs_1.default, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Reports', to: '/admin/reports' }] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Reports & Analytics" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: "Comprehensive insights into learner progress, engagement, and course effectiveness" })] }), (0, jsx_runtime_1.jsx)("div", { className: "card-lg card-hover mb-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Calendar, { className: "h-5 w-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("select", { value: dateRange, onChange: function (e) { return setDateRange(e.target.value); }, className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "last-7-days", children: "Last 7 Days" }), (0, jsx_runtime_1.jsx)("option", { value: "last-30-days", children: "Last 30 Days" }), (0, jsx_runtime_1.jsx)("option", { value: "last-90-days", children: "Last 90 Days" }), (0, jsx_runtime_1.jsx)("option", { value: "last-year", children: "Last Year" }), (0, jsx_runtime_1.jsx)("option", { value: "custom", children: "Custom Range" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Filter, { className: "h-5 w-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("select", { value: reportType, onChange: function (e) { return setReportType(e.target.value); }, className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "overview", children: "Overview" }), (0, jsx_runtime_1.jsx)("option", { value: "learners", children: "Learner Progress" }), (0, jsx_runtime_1.jsx)("option", { value: "courses", children: "Course Performance" }), (0, jsx_runtime_1.jsx)("option", { value: "organizations", children: "Organizations" }), (0, jsx_runtime_1.jsx)("option", { value: "engagement", children: "Engagement" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4", children: [(0, jsx_runtime_1.jsxs)("button", { onClick: refreshReports, className: "flex items-center space-x-2 text-gray-600 hover:text-gray-900 font-medium", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Refresh" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: exportReport, className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Export Report" })] })] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: overviewStats.map(function (stat, index) { return ((0, jsx_runtime_1.jsx)("div", { className: "card-lg", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-600", children: stat.label }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: stat.value }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center mt-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium ".concat(stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'), children: stat.change }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-500 ml-1", children: "vs last period" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "p-3 rounded-lg bg-orange-50", children: (0, jsx_runtime_1.jsx)(lucide_react_1.TrendingUp, { className: "h-6 w-6 text-orange-500" }) })] }) }, index)); }) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "card-lg", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Module Performance" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: modulePerformance.map(function (module, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-2", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-medium text-gray-900 text-sm", children: module.name }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-sm font-bold text-gray-900", children: [module.rate, "%"] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: module.rating }), (0, jsx_runtime_1.jsx)("div", { className: "text-yellow-400 text-sm", children: "\u2605" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm text-gray-600 mb-2", children: [(0, jsx_runtime_1.jsxs)("span", { children: [module.completions, "/", module.enrollments, " completed"] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Avg: ", module.avgTime] })] }), (0, jsx_runtime_1.jsx)("div", { className: "w-full bg-gray-200 rounded-full h-2", children: (0, jsx_runtime_1.jsx)("div", { className: "h-2 rounded-full", style: { width: "".concat(module.rate, "%"), background: 'var(--gradient-blue-green)' } }) })] }, index)); }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Weekly Engagement" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: engagementData.map(function (day, index) { return ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-12 text-sm font-medium text-gray-900", children: day.day }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-3 h-3 bg-blue-500 rounded-full" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm text-gray-600", children: [day.logins, " logins"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-3 h-3 bg-green-500 rounded-full" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm text-gray-600", children: [day.completions, " completions"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-3 h-3 bg-orange-500 rounded-full" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm text-gray-600", children: [day.feedback, " feedback"] })] })] })] }) }, index)); }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg mb-8", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Organization Performance" }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-gray-50", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "text-left py-3 px-4 font-semibold text-gray-900", children: "Organization" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Learners" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Completion Rate" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Engagement" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Last Activity" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: organizationPerformance.map(function (org, index) { return ((0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-gray-100 hover:bg-gray-50", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4", children: (0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: org.name }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4 text-center", children: (0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: org.learners }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4 text-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "font-bold text-gray-900", children: [org.completion, "%"] }), (0, jsx_runtime_1.jsx)("div", { className: "w-16 bg-gray-200 rounded-full h-1 mt-1", children: (0, jsx_runtime_1.jsx)("div", { className: "h-1 rounded-full", style: { width: "".concat(org.completion, "%"), background: 'var(--gradient-blue-green)' } }) })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4 text-center", children: (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getEngagementColor(org.engagement)), children: org.engagement }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4 text-center text-sm text-gray-600", children: new Date(org.lastActivity).toLocaleDateString() }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-4 text-center", children: (0, jsx_runtime_1.jsx)("button", { className: "p-1 text-blue-600 hover:text-blue-800", title: "View Details", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }) })] }, index)); }) })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg mb-8", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Feedback Summary" }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: feedbackSummary.map(function (feedback, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-gray-900 mb-1", children: feedback.score }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm font-medium text-gray-700 mb-1", children: feedback.category }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-gray-500 mb-2", children: [feedback.responses, " responses"] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-green-600 font-medium", children: [feedback.trend, " vs last month"] })] }, index)); }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-6", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900", children: "Generated Reports" }), (0, jsx_runtime_1.jsxs)("button", { onClick: generateNewReport, className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.BarChart3, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Generate New Report" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: reports.map(function (report, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "card-lg hover:shadow-md transition-shadow duration-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between mb-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-medium text-gray-900", children: report.name }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mt-1", children: report.description })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () { return viewReport(report.name); }, className: "p-1 text-blue-600 hover:text-blue-800", title: "View", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return downloadReport(report.name); }, className: "p-1 text-gray-600 hover:text-gray-800", title: "Download", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return shareReport(report.name); }, className: "p-1 text-gray-600 hover:text-gray-800", title: "Share", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Share, { className: "h-4 w-4" }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm text-gray-500", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Generated: ", new Date(report.lastGenerated).toLocaleDateString()] }), (0, jsx_runtime_1.jsxs)("span", { children: [report.format, " \u2022 ", report.size] })] })] }, index)); }) })] })] }));
};
exports.default = AdminReports;
