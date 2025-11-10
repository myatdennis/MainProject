import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { AlertTriangle, Clock, Target, Brain, Download, Filter, Calendar, RefreshCw, Eye, Zap } from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
const AdminAnalytics = () => {
    const [dateRange, setDateRange] = useState('last-30-days');
    const [selectedMetric, setSelectedMetric] = useState('engagement');
    const refreshAnalytics = () => {
        console.log('Refreshing analytics...');
        alert('Analytics refreshed (demo)');
    };
    const exportInsights = () => {
        const data = { exportedAt: new Date().toISOString(), metric: selectedMetric };
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        const a = document.createElement('a');
        a.setAttribute('href', dataStr);
        a.setAttribute('download', `insights-${selectedMetric}-${Date.now()}.json`);
        document.body.appendChild(a);
        a.click();
        a.remove();
    };
    const applySuggestion = (title) => {
        alert(`${title} applied (demo)`);
    };
    const scheduleNow = (title) => {
        alert(`${title} scheduled (demo)`);
    };
    const createGroup = (title) => {
        alert(`${title} group created (demo)`);
    };
    const aiInsights = [
        {
            type: 'warning',
            title: 'At-Risk Learners Detected',
            description: '23 learners are predicted to drop out based on engagement patterns',
            confidence: 87,
            action: 'Send targeted interventions',
            icon: AlertTriangle,
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
            icon: Target,
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
            icon: Clock,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200'
        }
    ];
    const predictiveMetrics = [
        { label: 'Completion Probability', value: '78%', trend: '+5%', color: 'text-green-600' },
        { label: 'Dropout Risk', value: '12%', trend: '-3%', color: 'text-red-600' },
        { label: 'Engagement Score', value: '8.4/10', trend: '+0.7', color: 'text-blue-600' },
        { label: 'Content Effectiveness', value: '85%', trend: '+12%', color: 'text-purple-600' }
    ];
    const engagementHeatmap = [
        { day: 'Mon', hours: [2, 5, 8, 12, 15, 18, 14, 10, 6, 3, 1, 0] },
        { day: 'Tue', hours: [1, 4, 9, 15, 22, 28, 25, 18, 12, 7, 3, 1] },
        { day: 'Wed', hours: [3, 6, 11, 18, 24, 30, 27, 20, 14, 8, 4, 2] },
        { day: 'Thu', hours: [2, 7, 13, 20, 26, 32, 29, 22, 16, 9, 5, 2] },
        { day: 'Fri', hours: [4, 8, 14, 21, 25, 28, 24, 17, 11, 6, 3, 1] },
        { day: 'Sat', hours: [1, 3, 6, 9, 12, 15, 13, 10, 7, 4, 2, 1] },
        { day: 'Sun', hours: [0, 2, 4, 7, 10, 13, 11, 8, 5, 3, 1, 0] }
    ];
    const learnerJourney = [
        { stage: 'Enrollment', users: 247, conversion: 100, avgTime: '0 days' },
        { stage: 'First Login', users: 234, conversion: 95, avgTime: '1.2 days' },
        { stage: 'Module 1 Start', users: 221, conversion: 89, avgTime: '2.8 days' },
        { stage: 'Module 1 Complete', users: 198, conversion: 80, avgTime: '5.4 days' },
        { stage: 'Module 2 Start', users: 189, conversion: 77, avgTime: '7.1 days' },
        { stage: 'Module 3 Complete', users: 156, conversion: 63, avgTime: '14.2 days' },
        { stage: 'Certification', users: 142, conversion: 58, avgTime: '21.5 days' }
    ];
    const contentPerformance = [
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
    const getHeatmapColor = (value) => {
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
    return (_jsxs("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [_jsx("div", { className: "mb-6", children: _jsx(Breadcrumbs, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Analytics', to: '/admin/analytics' }] }) }), _jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Advanced Analytics & AI Insights" }), _jsx("p", { className: "text-gray-600", children: "AI-powered analytics to optimize learning experiences and predict outcomes" })] }), _jsx("div", { className: "card-lg card-hover mb-8", children: _jsxs("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [_jsxs("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Calendar, { className: "h-5 w-5 text-gray-400" }), _jsxs("select", { value: dateRange, onChange: (e) => setDateRange(e.target.value), className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [_jsx("option", { value: "last-7-days", children: "Last 7 Days" }), _jsx("option", { value: "last-30-days", children: "Last 30 Days" }), _jsx("option", { value: "last-90-days", children: "Last 90 Days" }), _jsx("option", { value: "last-year", children: "Last Year" })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Filter, { className: "h-5 w-5 text-gray-400" }), _jsxs("select", { value: selectedMetric, onChange: (e) => setSelectedMetric(e.target.value), className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [_jsx("option", { value: "engagement", children: "Engagement Analysis" }), _jsx("option", { value: "performance", children: "Performance Metrics" }), _jsx("option", { value: "predictive", children: "Predictive Analytics" }), _jsx("option", { value: "content", children: "Content Analysis" })] })] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("button", { onClick: refreshAnalytics, className: "flex items-center space-x-2 text-gray-600 hover:text-gray-900 font-medium", children: [_jsx(RefreshCw, { className: "h-4 w-4" }), _jsx("span", { children: "Refresh AI Analysis" })] }), _jsxs("button", { onClick: exportInsights, className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [_jsx(Download, { className: "h-4 w-4" }), _jsx("span", { children: "Export Insights" })] })] })] }) }), _jsxs("div", { className: "mb-8", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-6", children: [_jsx(Brain, { className: "h-6 w-6 text-purple-500" }), _jsx("h2", { className: "text-xl font-bold text-gray-900", children: "AI-Powered Insights" })] }), _jsx("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: aiInsights.map((insight, index) => {
                            const Icon = insight.icon;
                            return (_jsx("div", { className: `p-6 rounded-lg border ${insight.borderColor} ${insight.bgColor}`, children: _jsxs("div", { className: "flex items-start space-x-3 mb-4", children: [_jsx(Icon, { className: `h-6 w-6 ${insight.color} mt-0.5` }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-1", children: insight.title }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: insight.description }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-xs text-gray-500", children: ["Confidence: ", insight.confidence, "%"] }), _jsxs("button", { onClick: () => applySuggestion(insight.title), className: `text-sm font-medium ${insight.color} hover:underline`, children: [insight.action, " \u2192"] })] })] })] }) }, index));
                        }) })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: predictiveMetrics.map((metric, index) => (_jsx("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: metric.label }), _jsx("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: metric.value }), _jsxs("div", { className: "flex items-center mt-2", children: [_jsx("span", { className: `text-sm font-medium ${metric.color}`, children: metric.trend }), _jsx("span", { className: "text-sm text-gray-500 ml-1", children: "vs last period" })] })] }), _jsx("div", { className: "p-3 rounded-lg bg-purple-50", children: _jsx(Brain, { className: "h-6 w-6 text-purple-500" }) })] }) }, index))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8", children: [_jsxs("div", { className: "card-lg", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Engagement Heatmap" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "grid grid-cols-13 gap-1 text-xs text-gray-500 mb-2", children: [_jsx("div", {}), Array.from({ length: 12 }, (_, i) => (_jsx("div", { className: "text-center", children: i === 0 ? '12a' : i < 12 ? `${i}a` : '12p' }, i)))] }), engagementHeatmap.map((day, dayIndex) => (_jsxs("div", { className: "grid grid-cols-13 gap-1", children: [_jsx("div", { className: "text-xs text-gray-500 py-1", children: day.day }), day.hours.map((value, hourIndex) => (_jsx("div", { className: `h-4 rounded-sm ${getHeatmapColor(value)}`, title: `${day.day} ${hourIndex}:00 - ${value} active learners` }, hourIndex)))] }, dayIndex)))] }), _jsxs("div", { className: "flex items-center justify-between mt-4 text-xs text-gray-500", children: [_jsx("span", { children: "Less active" }), _jsxs("div", { className: "flex space-x-1", children: [_jsx("div", { className: "w-3 h-3 bg-gray-100 rounded-sm" }), _jsx("div", { className: "w-3 h-3 bg-blue-100 rounded-sm" }), _jsx("div", { className: "w-3 h-3 bg-blue-300 rounded-sm" }), _jsx("div", { className: "w-3 h-3 bg-blue-500 rounded-sm" }), _jsx("div", { className: "w-3 h-3 bg-blue-600 rounded-sm" })] }), _jsx("span", { children: "More active" })] })] }), _jsxs("div", { className: "card-lg", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Learner Journey Analysis" }), _jsx("div", { className: "space-y-4", children: learnerJourney.map((stage, index) => (_jsxs("div", { className: "flex items-center justify-between p-3 border border-gray-200 rounded-lg", children: [_jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-gray-900", children: stage.stage }), _jsxs("div", { className: "text-sm text-gray-600", children: [stage.users, " users \u2022 Avg: ", stage.avgTime] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "text-lg font-bold text-gray-900", children: [stage.conversion, "%"] }), _jsx("div", { className: "w-16 bg-gray-200 rounded-full h-2 mt-1", children: _jsx("div", { className: "h-2 rounded-full", style: { width: `${stage.conversion}%`, background: 'var(--gradient-blue-green)' } }) })] })] }, index))) })] })] }), _jsxs("div", { className: "card-lg mb-8", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Content Performance Analysis" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left py-3 px-4 font-semibold text-gray-900", children: "Content" }), _jsx("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Views" }), _jsx("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Completion" }), _jsx("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Avg. Time" }), _jsx("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Engagement" }), _jsx("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Rating" }), _jsx("th", { className: "text-center py-3 px-4 font-semibold text-gray-900", children: "Actions" })] }) }), _jsx("tbody", { children: contentPerformance.map((content, index) => (_jsxs("tr", { className: "border-b border-gray-100 hover:bg-gray-50", children: [_jsx("td", { className: "py-4 px-4", children: _jsx("div", { className: "font-medium text-gray-900", children: content.content }) }), _jsx("td", { className: "py-4 px-4 text-center", children: _jsx("div", { className: "font-medium text-gray-900", children: content.views }) }), _jsx("td", { className: "py-4 px-4 text-center", children: _jsxs("div", { className: "font-medium text-gray-900", children: [content.completion, "%"] }) }), _jsx("td", { className: "py-4 px-4 text-center text-gray-600", children: content.avgWatchTime }), _jsx("td", { className: "py-4 px-4 text-center", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getEngagementColor(content.engagement)}`, children: content.engagement }) }), _jsx("td", { className: "py-4 px-4 text-center", children: _jsxs("div", { className: "flex items-center justify-center space-x-1", children: [_jsx("span", { className: "font-medium text-gray-900", children: content.feedback }), _jsx("div", { className: "text-yellow-400", children: "\u2605" })] }) }), _jsx("td", { className: "py-4 px-4 text-center", children: _jsx("button", { className: "p-1 text-blue-600 hover:text-blue-800", title: "View Details", children: _jsx(Eye, { className: "h-4 w-4" }) }) })] }, index))) })] }) })] }), _jsxs("div", { className: "rounded-xl p-8", style: { background: 'var(--gradient-banner)' }, children: [_jsxs("div", { className: "flex items-center space-x-3 mb-6", children: [_jsx(Zap, { className: "h-6 w-6 text-purple-500" }), _jsx("h2", { className: "text-xl font-bold text-gray-900", children: "AI Recommendations" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "bg-white p-4 rounded-lg shadow-sm", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-2", children: "Optimize Content" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "Break down \"Conversation Template\" into smaller, interactive segments to improve engagement." }), _jsx("button", { onClick: () => applySuggestion('Optimize Content'), className: "text-sm text-purple-600 hover:text-purple-700 font-medium", children: "Apply Suggestion \u2192" })] }), _jsxs("div", { className: "bg-white p-4 rounded-lg shadow-sm", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-2", children: "Schedule Reminders" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "Send personalized reminders to 23 at-risk learners on Tuesday mornings for optimal engagement." }), _jsx("button", { onClick: () => scheduleNow('Schedule Reminders'), className: "text-sm text-purple-600 hover:text-purple-700 font-medium", children: "Schedule Now \u2192" })] }), _jsxs("div", { className: "bg-white p-4 rounded-lg shadow-sm", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-2", children: "Create Cohort" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "Group high-performing learners for peer mentoring to boost overall completion rates." }), _jsx("button", { onClick: () => createGroup('Create Cohort'), className: "text-sm text-purple-600 hover:text-purple-700 font-medium", children: "Create Group \u2192" })] })] })] })] }));
};
export default AdminAnalytics;
