import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { Users, Building2, Award, TrendingUp, ArrowUpRight, CheckCircle2, MessageSquare, AlertTriangle, Clock, BarChart3, Download, } from 'lucide-react';
const stats = [
    {
        label: 'Active learners',
        value: '247',
        change: '+12% vs last month',
        icon: Users,
        accent: 'text-skyblue',
    },
    {
        label: 'Partner organizations',
        value: '18',
        change: '+2 newly onboarded',
        icon: Building2,
        accent: 'text-forest',
    },
    {
        label: 'Courses completed',
        value: '1,234',
        change: '+8% completion growth',
        icon: Award,
        accent: 'text-sunrise',
    },
    {
        label: 'Avg. completion rate',
        value: '87%',
        change: '-3% vs last month',
        icon: TrendingUp,
        accent: 'text-gold',
    },
];
const recentActivity = [
    {
        title: 'Sarah Chen completed “Foundations of Inclusive Leadership”',
        subtitle: 'Pacific Coast University · 2 hours ago',
        icon: CheckCircle2,
        tone: 'text-forest',
    },
    {
        title: 'Marcus Rodriguez enrolled in “Courageous Conversations”',
        subtitle: 'Mountain View High School · 4 hours ago',
        icon: Users,
        tone: 'text-skyblue',
    },
    {
        title: 'Jennifer Walsh submitted course feedback',
        subtitle: 'Community Impact Network · 6 hours ago',
        icon: MessageSquare,
        tone: 'text-sunrise',
    },
    {
        title: '15 learners overdue on “Recognizing Bias”',
        subtitle: 'Regional Fire Department · 1 day ago',
        icon: AlertTriangle,
        tone: 'text-deepred',
    },
];
const alerts = [
    {
        title: '15 learners have overdue modules',
        description: 'Send reminder notifications to improve completion rates.',
        action: 'Send reminders',
        icon: Clock,
        tone: 'text-sunrise',
    },
    {
        title: 'New organization pending approval',
        description: 'TechForward Solutions has requested access to the portal.',
        action: 'Review request',
        icon: Building2,
        tone: 'text-skyblue',
    },
    {
        title: 'Monthly report ready',
        description: 'February analytics report is available for download.',
        action: 'Download report',
        icon: BarChart3,
        tone: 'text-forest',
    },
];
const topPerformingOrgs = [
    { name: 'Pacific Coast University', completion: 94, learners: 45 },
    { name: 'Community Impact Network', completion: 91, learners: 28 },
    { name: 'Regional Medical Center', completion: 89, learners: 67 },
    { name: 'Mountain View High School', completion: 87, learners: 23 },
    { name: 'TechForward Solutions', completion: 85, learners: 34 },
];
const modulePerformance = [
    { name: 'Foundations of Inclusive Leadership', completion: 92, avgTime: '45 min' },
    { name: 'Empathy in Action', completion: 89, avgTime: '38 min' },
    { name: 'Courageous Conversations', completion: 84, avgTime: '52 min' },
    { name: 'Recognizing and Mitigating Bias', completion: 81, avgTime: '58 min' },
    { name: 'Personal & Team Action Planning', completion: 78, avgTime: '35 min' },
];
const AdminDashboard = () => {
    const navigate = useNavigate();
    const reportCsv = useMemo(() => {
        const header = ['Module Name,Completion Rate,Average Time'];
        const rows = modulePerformance.map((module) => `${module.name},${module.completion}%,${module.avgTime}`);
        return [...header, ...rows].join('\n');
    }, []);
    const handleExportReport = () => {
        const blob = new Blob([reportCsv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `huddleco-admin-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };
    return (_jsxs(_Fragment, { children: [_jsx(SEO, { title: "Admin Dashboard", description: "Monitor learner progress and organizational impact." }), _jsxs("div", { className: "container-page section", children: [_jsx(Breadcrumbs, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Dashboard', to: '/admin/dashboard' }] }), _jsxs("section", { className: "space-y-10", children: [_jsx(Card, { tone: "gradient", withBorder: false, className: "overflow-hidden", children: _jsxs("div", { className: "relative z-10 flex flex-col gap-4 text-charcoal md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx(Badge, { tone: "info", className: "bg-white/80 text-skyblue", children: "Executive Overview" }), _jsx("h1", { className: "mt-4 font-heading text-3xl font-bold md:text-4xl", children: "Track impact across every cohort and organization." }), _jsx("p", { className: "mt-3 max-w-2xl text-sm text-slate/80", children: "Review adoption, celebrate wins, and focus your facilitation where support is needed most." })] }), _jsxs("div", { className: "flex flex-col gap-3 md:items-end", children: [_jsx(Button, { size: "sm", trailingIcon: _jsx(ArrowUpRight, { className: "h-4 w-4" }), onClick: () => navigate('/admin/analytics'), children: "View analytics" }), _jsx(Button, { variant: "ghost", size: "sm", trailingIcon: _jsx(Download, { className: "h-4 w-4" }), onClick: handleExportReport, children: "Export summary" })] })] }) }), _jsx("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-4", children: stats.map((stat) => {
                                    const Icon = stat.icon;
                                    return (_jsxs(Card, { tone: "muted", className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-wide text-slate/70", children: stat.label }), _jsx(Icon, { className: `h-5 w-5 ${stat.accent}` })] }), _jsx("p", { className: "font-heading text-2xl font-bold text-charcoal", children: stat.value }), _jsx("p", { className: "text-xs text-slate/70", children: stat.change })] }, stat.label));
                                }) }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]", children: [_jsxs(Card, { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Recent activity" }), _jsx(Button, { variant: "ghost", size: "sm", trailingIcon: _jsx(ArrowUpRight, { className: "h-4 w-4" }), children: "View all" })] }), _jsx("div", { className: "space-y-4", children: recentActivity.map((item) => {
                                                    const Icon = item.icon;
                                                    return (_jsxs("div", { className: "flex items-start gap-3 rounded-2xl border border-mist/60 bg-white px-4 py-3 shadow-card-sm", children: [_jsx("span", { className: `mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-cloud ${item.tone}`, children: _jsx(Icon, { className: "h-4 w-4" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-heading text-sm font-semibold text-charcoal", children: item.title }), _jsx("p", { className: "text-xs text-slate/70", children: item.subtitle })] })] }, item.title));
                                                }) })] }), _jsxs(Card, { tone: "muted", className: "space-y-4", children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Alerts" }), _jsx("div", { className: "space-y-3", children: alerts.map((alert) => {
                                                    const Icon = alert.icon;
                                                    return (_jsx("div", { className: "rounded-2xl border border-mist/60 bg-white px-4 py-3 shadow-card-sm", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: `flex h-9 w-9 items-center justify-center rounded-lg bg-cloud ${alert.tone}`, children: _jsx(Icon, { className: "h-4 w-4" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-heading text-sm font-semibold text-charcoal", children: alert.title }), _jsx("p", { className: "text-xs text-slate/70", children: alert.description }), _jsx(Button, { variant: "ghost", size: "sm", className: "mt-2 text-skyblue", children: alert.action })] })] }) }, alert.title));
                                                }) })] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Top performing organizations" }), _jsx(Badge, { tone: "info", className: "bg-skyblue/10 text-skyblue", children: "Completion benchmarks" })] }), _jsx("div", { className: "space-y-3", children: topPerformingOrgs.map((org) => (_jsxs("div", { className: "rounded-2xl border border-mist/50 bg-white px-4 py-3 shadow-card-sm", children: [_jsxs("div", { className: "flex items-center justify-between text-sm font-semibold text-charcoal", children: [_jsx("span", { children: org.name }), _jsxs("span", { children: [org.completion, "%"] })] }), _jsx(ProgressBar, { value: org.completion, className: "mt-2", tone: "info", srLabel: `${org.name} completion` }), _jsxs("p", { className: "text-xs text-slate/70", children: [org.learners, " learners enrolled"] })] }, org.name))) })] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Module performance" }), _jsx(Button, { variant: "ghost", size: "sm", trailingIcon: _jsx(ArrowUpRight, { className: "h-4 w-4" }), onClick: () => navigate('/admin/courses'), children: "Manage curriculum" })] }), _jsx("div", { className: "space-y-3", children: modulePerformance.map((module) => (_jsxs("div", { className: "rounded-2xl border border-mist/50 bg-white px-4 py-3 shadow-card-sm", children: [_jsxs("div", { className: "flex items-center justify-between text-sm font-semibold text-charcoal", children: [_jsx("span", { children: module.name }), _jsxs("span", { children: [module.completion, "%"] })] }), _jsx(ProgressBar, { value: module.completion, className: "mt-2", srLabel: `${module.name} completion` }), _jsxs("p", { className: "text-xs text-slate/70", children: ["Average time: ", module.avgTime] })] }, module.name))) })] })] })] })] })] }));
};
export default AdminDashboard;
