"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var SEO_1 = require("../../components/SEO/SEO");
var Card_1 = require("../../components/ui/Card");
var Button_1 = require("../../components/ui/Button");
var Badge_1 = require("../../components/ui/Badge");
var ProgressBar_1 = require("../../components/ui/ProgressBar");
var Breadcrumbs_1 = require("../../components/ui/Breadcrumbs");
var lucide_react_1 = require("lucide-react");
var stats = [
    {
        label: 'Active learners',
        value: '247',
        change: '+12% vs last month',
        icon: lucide_react_1.Users,
        accent: 'text-skyblue',
    },
    {
        label: 'Partner organizations',
        value: '18',
        change: '+2 newly onboarded',
        icon: lucide_react_1.Building2,
        accent: 'text-forest',
    },
    {
        label: 'Courses completed',
        value: '1,234',
        change: '+8% completion growth',
        icon: lucide_react_1.Award,
        accent: 'text-sunrise',
    },
    {
        label: 'Avg. completion rate',
        value: '87%',
        change: '-3% vs last month',
        icon: lucide_react_1.TrendingUp,
        accent: 'text-gold',
    },
];
var recentActivity = [
    {
        title: 'Sarah Chen completed “Foundations of Inclusive Leadership”',
        subtitle: 'Pacific Coast University · 2 hours ago',
        icon: lucide_react_1.CheckCircle2,
        tone: 'text-forest',
    },
    {
        title: 'Marcus Rodriguez enrolled in “Courageous Conversations”',
        subtitle: 'Mountain View High School · 4 hours ago',
        icon: lucide_react_1.Users,
        tone: 'text-skyblue',
    },
    {
        title: 'Jennifer Walsh submitted course feedback',
        subtitle: 'Community Impact Network · 6 hours ago',
        icon: lucide_react_1.MessageSquare,
        tone: 'text-sunrise',
    },
    {
        title: '15 learners overdue on “Recognizing Bias”',
        subtitle: 'Regional Fire Department · 1 day ago',
        icon: lucide_react_1.AlertTriangle,
        tone: 'text-deepred',
    },
];
var alerts = [
    {
        title: '15 learners have overdue modules',
        description: 'Send reminder notifications to improve completion rates.',
        action: 'Send reminders',
        icon: lucide_react_1.Clock,
        tone: 'text-sunrise',
    },
    {
        title: 'New organization pending approval',
        description: 'TechForward Solutions has requested access to the portal.',
        action: 'Review request',
        icon: lucide_react_1.Building2,
        tone: 'text-skyblue',
    },
    {
        title: 'Monthly report ready',
        description: 'February analytics report is available for download.',
        action: 'Download report',
        icon: lucide_react_1.BarChart3,
        tone: 'text-forest',
    },
];
var topPerformingOrgs = [
    { name: 'Pacific Coast University', completion: 94, learners: 45 },
    { name: 'Community Impact Network', completion: 91, learners: 28 },
    { name: 'Regional Medical Center', completion: 89, learners: 67 },
    { name: 'Mountain View High School', completion: 87, learners: 23 },
    { name: 'TechForward Solutions', completion: 85, learners: 34 },
];
var modulePerformance = [
    { name: 'Foundations of Inclusive Leadership', completion: 92, avgTime: '45 min' },
    { name: 'Empathy in Action', completion: 89, avgTime: '38 min' },
    { name: 'Courageous Conversations', completion: 84, avgTime: '52 min' },
    { name: 'Recognizing and Mitigating Bias', completion: 81, avgTime: '58 min' },
    { name: 'Personal & Team Action Planning', completion: 78, avgTime: '35 min' },
];
var AdminDashboard = function () {
    var navigate = (0, react_router_dom_1.useNavigate)();
    var reportCsv = (0, react_1.useMemo)(function () {
        var header = ['Module Name,Completion Rate,Average Time'];
        var rows = modulePerformance.map(function (module) { return "".concat(module.name, ",").concat(module.completion, "%,").concat(module.avgTime); });
        return __spreadArray(__spreadArray([], header, true), rows, true).join('\n');
    }, []);
    var handleExportReport = function () {
        var blob = new Blob([reportCsv], { type: 'text/csv' });
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = "huddleco-admin-report-".concat(new Date().toISOString().split('T')[0], ".csv");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(SEO_1.default, { title: "Admin Dashboard", description: "Monitor learner progress and organizational impact." }), (0, jsx_runtime_1.jsxs)("div", { className: "container-page section", children: [(0, jsx_runtime_1.jsx)(Breadcrumbs_1.default, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Dashboard', to: '/admin/dashboard' }] }), (0, jsx_runtime_1.jsxs)("section", { className: "space-y-10", children: [(0, jsx_runtime_1.jsx)(Card_1.default, { tone: "gradient", withBorder: false, className: "overflow-hidden", children: (0, jsx_runtime_1.jsxs)("div", { className: "relative z-10 flex flex-col gap-4 text-charcoal md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Badge_1.default, { tone: "info", className: "bg-white/80 text-skyblue", children: "Executive Overview" }), (0, jsx_runtime_1.jsx)("h1", { className: "mt-4 font-heading text-3xl font-bold md:text-4xl", children: "Track impact across every cohort and organization." }), (0, jsx_runtime_1.jsx)("p", { className: "mt-3 max-w-2xl text-sm text-slate/80", children: "Review adoption, celebrate wins, and focus your facilitation where support is needed most." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 md:items-end", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { size: "sm", trailingIcon: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowUpRight, { className: "h-4 w-4" }), onClick: function () { return navigate('/admin/analytics'); }, children: "View analytics" }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "ghost", size: "sm", trailingIcon: (0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "h-4 w-4" }), onClick: handleExportReport, children: "Export summary" })] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-4", children: stats.map(function (stat) {
                                    var Icon = stat.icon;
                                    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { tone: "muted", className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs font-semibold uppercase tracking-wide text-slate/70", children: stat.label }), (0, jsx_runtime_1.jsx)(Icon, { className: "h-5 w-5 ".concat(stat.accent) })] }), (0, jsx_runtime_1.jsx)("p", { className: "font-heading text-2xl font-bold text-charcoal", children: stat.value }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate/70", children: stat.change })] }, stat.label));
                                }) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]", children: [(0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Recent activity" }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "ghost", size: "sm", trailingIcon: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowUpRight, { className: "h-4 w-4" }), children: "View all" })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: recentActivity.map(function (item) {
                                                    var Icon = item.icon;
                                                    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-3 rounded-2xl border border-mist/60 bg-white px-4 py-3 shadow-card-sm", children: [(0, jsx_runtime_1.jsx)("span", { className: "mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-cloud ".concat(item.tone), children: (0, jsx_runtime_1.jsx)(Icon, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "font-heading text-sm font-semibold text-charcoal", children: item.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate/70", children: item.subtitle })] })] }, item.title));
                                                }) })] }), (0, jsx_runtime_1.jsxs)(Card_1.default, { tone: "muted", className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Alerts" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: alerts.map(function (alert) {
                                                    var Icon = alert.icon;
                                                    return ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-mist/60 bg-white px-4 py-3 shadow-card-sm", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "flex h-9 w-9 items-center justify-center rounded-lg bg-cloud ".concat(alert.tone), children: (0, jsx_runtime_1.jsx)(Icon, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "font-heading text-sm font-semibold text-charcoal", children: alert.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate/70", children: alert.description }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "ghost", size: "sm", className: "mt-2 text-skyblue", children: alert.action })] })] }) }, alert.title));
                                                }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 lg:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Top performing organizations" }), (0, jsx_runtime_1.jsx)(Badge_1.default, { tone: "info", className: "bg-skyblue/10 text-skyblue", children: "Completion benchmarks" })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: topPerformingOrgs.map(function (org) { return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-mist/50 bg-white px-4 py-3 shadow-card-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm font-semibold text-charcoal", children: [(0, jsx_runtime_1.jsx)("span", { children: org.name }), (0, jsx_runtime_1.jsxs)("span", { children: [org.completion, "%"] })] }), (0, jsx_runtime_1.jsx)(ProgressBar_1.default, { value: org.completion, className: "mt-2", tone: "info", srLabel: "".concat(org.name, " completion") }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate/70", children: [org.learners, " learners enrolled"] })] }, org.name)); }) })] }), (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Module performance" }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "ghost", size: "sm", trailingIcon: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowUpRight, { className: "h-4 w-4" }), onClick: function () { return navigate('/admin/courses'); }, children: "Manage curriculum" })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: modulePerformance.map(function (module) { return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-mist/50 bg-white px-4 py-3 shadow-card-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm font-semibold text-charcoal", children: [(0, jsx_runtime_1.jsx)("span", { children: module.name }), (0, jsx_runtime_1.jsxs)("span", { children: [module.completion, "%"] })] }), (0, jsx_runtime_1.jsx)(ProgressBar_1.default, { value: module.completion, className: "mt-2", srLabel: "".concat(module.name, " completion") }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate/70", children: ["Average time: ", module.avgTime] })] }, module.name)); }) })] })] })] })] })] }));
};
exports.default = AdminDashboard;
