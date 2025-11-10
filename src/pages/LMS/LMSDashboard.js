import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
// React import not required with the new JSX transform
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Clock, Award, TrendingUp, Play, CheckCircle, Calendar, Download, MessageSquare } from 'lucide-react';
const LMSDashboard = () => {
    const { user } = useAuth();
    const modules = [
        {
            id: 'foundations',
            title: 'Foundations of Inclusive Leadership',
            progress: 100,
            status: 'completed',
            duration: '45 min',
            type: 'Video + Worksheet'
        },
        {
            id: 'bias',
            title: 'Recognizing and Mitigating Bias',
            progress: 75,
            status: 'in-progress',
            duration: '60 min',
            type: 'Interactive + Quiz'
        },
        {
            id: 'empathy',
            title: 'Empathy in Action',
            progress: 50,
            status: 'in-progress',
            duration: '40 min',
            type: 'Case Study'
        },
        {
            id: 'conversations',
            title: 'Courageous Conversations at Work',
            progress: 0,
            status: 'not-started',
            duration: '55 min',
            type: 'Video + Template'
        },
        {
            id: 'action-planning',
            title: 'Personal & Team Action Planning',
            progress: 0,
            status: 'not-started',
            duration: '30 min',
            type: 'Worksheet + Coaching'
        }
    ];
    const stats = [
        { label: 'Modules Completed', value: '1/5', icon: BookOpen, color: 'text-blue-500' },
        { label: 'Total Progress', value: '45%', icon: TrendingUp, color: 'text-green-500' },
        { label: 'Time Invested', value: '2.5 hrs', icon: Clock, color: 'text-orange-500' },
        { label: 'Certificates Earned', value: '0', icon: Award, color: 'text-purple-500' }
    ];
    const recentActivity = [
        {
            action: 'Completed',
            item: 'Foundations of Inclusive Leadership',
            time: '2 days ago',
            icon: CheckCircle,
            color: 'text-green-500'
        },
        {
            action: 'Downloaded',
            item: 'Leadership Reflection Worksheet',
            time: '3 days ago',
            icon: Download,
            color: 'text-blue-500'
        },
        {
            action: 'Started',
            item: 'Recognizing and Mitigating Bias',
            time: '1 week ago',
            icon: Play,
            color: 'text-orange-500'
        }
    ];
    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'in-progress':
                return 'bg-orange-100 text-orange-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    const getStatusText = (status) => {
        switch (status) {
            case 'completed':
                return 'Completed';
            case 'in-progress':
                return 'In Progress';
            default:
                return 'Not Started';
        }
    };
    return (_jsxs("div", { className: "container-page section", children: [_jsxs("div", { className: "mb-8", children: [_jsxs("h1", { className: "h1", children: ["Welcome back, ", user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Learner' : 'Learner', "!"] }), _jsx("p", { className: "lead", children: "Continue your inclusive leadership journey. You're making great progress!" })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (_jsx("div", { className: "card-lg hover-lift", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate/80", children: stat.label }), _jsx("p", { className: "text-2xl font-bold text-charcoal mt-1", children: stat.value })] }), _jsx("div", { className: `p-3 rounded-lg bg-white/8`, children: _jsx(Icon, { className: `h-6 w-6 ${stat.color}` }) })] }) }, index));
                }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [_jsx("div", { className: "lg:col-span-2", children: _jsxs("div", { className: "card-lg card-hover", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "h2", children: "Your Learning Path" }), _jsx(Link, { to: "/lms/courses", className: "nav-link", children: "View All Courses \u2192" })] }), _jsx("div", { className: "space-y-4", children: modules.map((module) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4 hover-lift transition-shadow duration-200", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "h3 mb-1", children: module.title }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-slate/80", children: [_jsxs("span", { className: "flex items-center", children: [_jsx(Clock, { className: "h-4 w-4 mr-1" }), module.duration] }), _jsx("span", { children: module.type })] })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(module.status)}`, children: getStatusText(module.status) }), _jsx(Link, { to: `/lms/module/${module.id}`, className: "btn-cta px-4 py-2 rounded-lg text-sm font-medium", children: module.status === 'completed' ? 'Review' : module.status === 'in-progress' ? 'Continue' : 'Start' })] })] }), _jsx("div", { className: "w-full bg-mist/60 rounded-full h-2", children: _jsx("div", { className: "h-2 rounded-full transition-all duration-300", style: { width: `${module.progress}%`, backgroundImage: 'var(--gradient-blue-green)' } }) }), _jsxs("div", { className: "text-right text-sm text-slate/80 mt-1", children: [module.progress, "% complete"] })] }, module.id))) })] }) }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "card-lg card-hover", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Quick Actions" }), _jsxs("div", { className: "space-y-3", children: [_jsxs(Link, { to: "/lms/downloads", className: "flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200", children: [_jsx(Download, { className: "h-5 w-5 text-blue-500 mr-3" }), _jsx("span", { className: "font-medium text-gray-900", children: "Download All Resources" })] }), _jsxs(Link, { to: "/lms/feedback", className: "flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200", children: [_jsx(MessageSquare, { className: "h-5 w-5 text-green-500 mr-3" }), _jsx("span", { className: "font-medium text-gray-900", children: "Submit Feedback" })] }), _jsxs(Link, { to: "/lms/contact", className: "flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200", children: [_jsx(Calendar, { className: "h-5 w-5 text-orange-500 mr-3" }), _jsx("span", { className: "font-medium text-gray-900", children: "Book Coaching Call" })] })] })] }), _jsxs("div", { className: "card-lg card-hover", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Recent Activity" }), _jsx("div", { className: "space-y-4", children: recentActivity.map((activity, index) => {
                                            const Icon = activity.icon;
                                            return (_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: `p-2 rounded-lg bg-gray-50`, children: _jsx(Icon, { className: `h-4 w-4 ${activity.color}` }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("p", { className: "text-sm font-medium text-gray-900", children: [activity.action, " ", _jsx("span", { className: "font-normal", children: activity.item })] }), _jsx("p", { className: "text-xs text-gray-500", children: activity.time })] })] }, index));
                                        }) })] }), _jsxs("div", { className: "rounded-xl p-6", style: { background: 'linear-gradient(90deg, color-mix(in srgb, var(--hud-blue) 10%, transparent), color-mix(in srgb, var(--hud-green) 10%, transparent))' }, children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-2", children: "Next Coaching Session" }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Scheduled for March 15, 2025 at 2:00 PM EST" }), _jsx("a", { href: "/lms/meeting", className: "btn-outline", children: "Join Meeting" })] })] })] })] }));
};
export default LMSDashboard;
