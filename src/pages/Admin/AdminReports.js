import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { BarChart3, TrendingUp, Download, Calendar, Filter, RefreshCw, Eye, Share } from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { useToast } from '../../context/ToastContext';
const AdminReports = () => {
    const [dateRange, setDateRange] = useState('last-30-days');
    const [reportType, setReportType] = useState('overview');
    const { showToast } = useToast();
    const refreshReports = () => {
        console.log('Refreshing reports...');
        showToast('Reports refreshed', 'success');
    };
    const exportReport = () => {
        const data = { exportedAt: new Date().toISOString(), reportType };
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        const a = document.createElement('a');
        a.setAttribute('href', dataStr);
        a.setAttribute('download', `report-${reportType}-${Date.now()}.json`);
        document.body.appendChild(a);
        a.click();
        a.remove();
    };
    const generateNewReport = () => {
        showToast('Generating report…', 'info');
    };
    const viewReport = (name) => {
        window.open(`/admin/report-preview?name=${encodeURIComponent(name)}`, '_blank');
    };
    const downloadReport = (name) => {
        const text = `Report: ${name}\nGenerated: ${new Date().toLocaleString()}`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/\s+/g, '_').toLowerCase()}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };
    const shareReport = (name) => {
        const link = `${window.location.origin}/admin/reports?shared=${encodeURIComponent(name)}`;
        navigator.clipboard?.writeText(link)
            .then(() => showToast('Report link copied to clipboard', 'success'))
            .catch(() => showToast('Copy not supported', 'error'));
    };
    const overviewStats = [
        { label: 'Total Learners', value: '247', change: '+12%', changeType: 'positive' },
        { label: 'Course Completions', value: '1,234', change: '+8%', changeType: 'positive' },
        { label: 'Avg. Completion Time', value: '3.2 days', change: '-15%', changeType: 'positive' },
        { label: 'Satisfaction Score', value: '4.8/5', change: '+0.2', changeType: 'positive' }
    ];
    const modulePerformance = [
        { name: 'Foundations of Inclusive Leadership', enrollments: 247, completions: 198, rate: 80, avgTime: '45 min', rating: 4.9 },
        { name: 'Empathy in Action', enrollments: 156, completions: 124, rate: 79, avgTime: '38 min', rating: 4.9 },
        { name: 'Recognizing and Mitigating Bias', enrollments: 189, completions: 142, rate: 75, avgTime: '58 min', rating: 4.8 },
        { name: 'Personal & Team Action Planning', enrollments: 98, completions: 67, rate: 68, avgTime: '35 min', rating: 4.7 },
        { name: 'Courageous Conversations at Work', enrollments: 45, completions: 23, rate: 51, avgTime: '52 min', rating: 4.6 }
    ];
    const organizationPerformance = [
        { name: 'Pacific Coast University', learners: 45, completion: 94, engagement: 'High', lastActivity: '2025-03-11' },
        { name: 'Community Impact Network', learners: 28, completion: 91, engagement: 'High', lastActivity: '2025-03-10' },
        { name: 'Regional Medical Center', learners: 67, completion: 89, engagement: 'Medium', lastActivity: '2025-03-11' },
        { name: 'Mountain View High School', learners: 23, completion: 87, engagement: 'High', lastActivity: '2025-03-09' },
        { name: 'TechForward Solutions', learners: 34, completion: 85, engagement: 'High', lastActivity: '2025-03-11' }
    ];
    const engagementData = [
        { day: 'Mon', logins: 45, completions: 12, feedback: 8 },
        { day: 'Tue', logins: 52, completions: 18, feedback: 11 },
        { day: 'Wed', logins: 38, completions: 15, feedback: 9 },
        { day: 'Thu', logins: 61, completions: 22, feedback: 14 },
        { day: 'Fri', logins: 43, completions: 16, feedback: 7 },
        { day: 'Sat', logins: 28, completions: 8, feedback: 3 },
        { day: 'Sun', logins: 31, completions: 9, feedback: 4 }
    ];
    const feedbackSummary = [
        { category: 'Content Quality', score: 4.8, responses: 156, trend: '+0.2' },
        { category: 'Ease of Use', score: 4.6, responses: 142, trend: '+0.1' },
        { category: 'Relevance', score: 4.9, responses: 168, trend: '+0.3' },
        { category: 'Support Quality', score: 4.7, responses: 89, trend: '+0.1' }
    ];
    const reports = [
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
    const getEngagementColor = (engagement) => {
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
    return (_jsxs("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [_jsx("div", { className: "mb-6", children: _jsx(Breadcrumbs, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Reports', to: '/admin/reports' }] }) }), _jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Reports & Analytics" }), _jsx("p", { className: "text-gray-600", children: "Comprehensive insights into learner progress, engagement, and course effectiveness" })] }), _jsx("div", { className: "card-lg card-hover mb-8", children: _jsxs("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [_jsxs("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Calendar, { className: "h-5 w-5 text-gray-400" }), _jsxs("select", { value: dateRange, onChange: (e) => setDateRange(e.target.value), className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [_jsx("option", { value: "last-7-days", children: "Last 7 Days" }), _jsx("option", { value: "last-30-days", children: "Last 30 Days" }), _jsx("option", { value: "last-90-days", children: "Last 90 Days" }), _jsx("option", { value: "last-year", children: "Last Year" }), _jsx("option", { value: "custom", children: "Custom Range" })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Filter, { className: "h-5 w-5 text-gray-400" }), _jsxs("select", { value: reportType, onChange: (e) => setReportType(e.target.value), className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [_jsx("option", { value: "overview", children: "Overview" }), _jsx("option", { value: "learners", children: "Learner Progress" }), _jsx("option", { value: "courses", children: "Course Performance" }), _jsx("option", { value: "organizations", children: "Organizations" }), _jsx("option", { value: "engagement", children: "Engagement" })] })] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("button", { onClick: refreshReports, className: "flex items-center space-x-2 text-gray-600 hover:text-gray-900 font-medium", children: [_jsx(RefreshCw, { className: "h-4 w-4" }), _jsx("span", { children: "Refresh" })] }), _jsxs("button", { onClick: exportReport, className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [_jsx(Download, { className: "h-4 w-4" }), _jsx("span", { children: "Export Report" })] })] })] }) }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: overviewStats.map((stat, index) => (_jsx("div", { className: "card-lg", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: stat.label }), _jsx("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: stat.value }), _jsxs("div", { className: "flex items-center mt-2", children: [_jsx("span", { className: `text-sm font-medium ${stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`, children: stat.change }), _jsx("span", { className: "text-sm text-gray-500 ml-1", children: "vs last period" })] })] }), _jsx("div", { className: "p-3 rounded-lg bg-orange-50", children: _jsx(TrendingUp, { className: "h-6 w-6 text-orange-500" }) })] }) }, index))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8", children: [_jsxs("div", { className: "card-lg", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Module Performance" }), _jsx("div", { className: "space-y-4", children: modulePerformance.map((module, index) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h3", { className: "font-medium text-gray-900 text-sm", children: module.name }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("span", { className: "text-sm font-bold text-gray-900", children: [module.rate, "%"] }), _jsxs("div", { className: "flex items-center space-x-1", children: [_jsx("span", { className: "text-sm text-gray-600", children: module.rating }), _jsx("div", { className: "text-yellow-400 text-sm", children: "\u2605" })] })] })] }), _jsxs("div", { className: "flex items-center justify-between text-sm text-gray-600 mb-2", children: [_jsxs("span", { children: [module.completions, "/", module.enrollments, " completed"] }), _jsxs("span", { children: ["Avg: ", module.avgTime] })] }), _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "h-2 rounded-full", style: { width: `${module.rate}%`, background: 'var(--gradient-blue-green)' } }) })] }, index))) })] }), _jsxs("div", { className: "card-lg", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Weekly Engagement" }), _jsx("div", { className: "space-y-4", children: engagementData.map((day, index) => (_jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "w-12 text-sm font-medium text-gray-900", children: day.day }), _jsxs("div", { className: "flex items-center space-x-6", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-3 h-3 bg-blue-500 rounded-full" }), _jsxs("span", { className: "text-sm text-gray-600", children: [day.logins, " logins"] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-3 h-3 bg-green-500 rounded-full" }), _jsxs("span", { className: "text-sm text-gray-600", children: [day.completions, " completions"] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-3 h-3 bg-orange-500 rounded-full" }), _jsxs("span", { className: "text-sm text-gray-600", children: [day.feedback, " feedback"] })] })] })] }) }, index))) })] })] }), _jsxs("div", { className: "card-lg mb-8", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Organization Performance" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left py-3 px-4 font-semibold text-gray-900", children: "Organization" }), _jsx("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Learners" }), _jsx("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Completion Rate" }), _jsx("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Engagement" }), _jsx("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Last Activity" }), _jsx("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Actions" })] }) }), _jsx("tbody", { children: organizationPerformance.map((org, index) => (_jsxs("tr", { className: "border-b border-gray-100 hover:bg-gray-50", children: [_jsx("td", { className: "py-4 px-4", children: _jsx("div", { className: "font-medium text-gray-900", children: org.name }) }), _jsx("td", { className: "py-4 px-4 text-center", children: _jsx("div", { className: "font-medium text-gray-900", children: org.learners }) }), _jsx("td", { className: "py-4 px-4 text-center", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "font-bold text-gray-900", children: [org.completion, "%"] }), _jsx("div", { className: "w-16 bg-gray-200 rounded-full h-1 mt-1", children: _jsx("div", { className: "h-1 rounded-full", style: { width: `${org.completion}%`, background: 'var(--gradient-blue-green)' } }) })] }) }), _jsx("td", { className: "py-4 px-4 text-center", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getEngagementColor(org.engagement)}`, children: org.engagement }) }), _jsx("td", { className: "py-4 px-4 text-center text-sm text-gray-600", children: new Date(org.lastActivity).toLocaleDateString() }), _jsx("td", { className: "py-4 px-4 text-center", children: _jsx("button", { className: "p-1 text-blue-600 hover:text-blue-800", title: "View Details", children: _jsx(Eye, { className: "h-4 w-4" }) }) })] }, index))) })] }) })] }), _jsxs("div", { className: "card-lg mb-8", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Feedback Summary" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: feedbackSummary.map((feedback, index) => (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900 mb-1", children: feedback.score }), _jsx("div", { className: "text-sm font-medium text-gray-700 mb-1", children: feedback.category }), _jsxs("div", { className: "text-xs text-gray-500 mb-2", children: [feedback.responses, " responses"] }), _jsxs("div", { className: "text-xs text-green-600 font-medium", children: [feedback.trend, " vs last month"] })] }, index))) })] }), _jsxs("div", { className: "card-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900", children: "Generated Reports" }), _jsxs("button", { onClick: generateNewReport, className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [_jsx(BarChart3, { className: "h-4 w-4" }), _jsx("span", { children: "Generate New Report" })] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: reports.map((report, index) => (_jsxs("div", { className: "card-lg hover:shadow-md transition-shadow duration-200", children: [_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-medium text-gray-900", children: report.name }), _jsx("p", { className: "text-sm text-gray-600 mt-1", children: report.description })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => viewReport(report.name), className: "p-1 text-blue-600 hover:text-blue-800", title: "View", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => downloadReport(report.name), className: "p-1 text-gray-600 hover:text-gray-800", title: "Download", children: _jsx(Download, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => shareReport(report.name), className: "p-1 text-gray-600 hover:text-gray-800", title: "Share", children: _jsx(Share, { className: "h-4 w-4" }) })] })] }), _jsxs("div", { className: "flex items-center justify-between text-sm text-gray-500", children: [_jsxs("span", { children: ["Generated: ", new Date(report.lastGenerated).toLocaleDateString()] }), _jsxs("span", { children: [report.format, " \u2022 ", report.size] })] })] }, index))) })] })] }));
};
export default AdminReports;
