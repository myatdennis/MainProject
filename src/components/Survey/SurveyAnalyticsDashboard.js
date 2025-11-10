import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import Skeleton from '../ui/Skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, Treemap } from 'recharts';
import { TrendingUp, Users, Clock, Download, AlertTriangle, CheckCircle, BarChart3, Map, FileText } from 'lucide-react';
const COLORS = ['#de7b12', '#3A7DFF', '#228B22', '#D72638', '#F6C87B', '#1E1E1E', '#de7b12', '#3A7DFF'];
const SurveyAnalyticsDashboard = ({ surveyId }) => {
    const [analytics, setAnalytics] = useState(null);
    const [activeView, setActiveView] = useState('overview');
    const [dateRange, setDateRange] = useState('30d');
    const [loading, setLoading] = useState(true);
    // Mock Data - In real app, this would come from API
    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            setAnalytics({
                surveyId,
                surveyTitle: 'Workplace Climate & Inclusion Index',
                overview: {
                    totalInvited: 1250,
                    totalResponses: 847,
                    completedResponses: 723,
                    inProgressResponses: 124,
                    responseRate: 67.8,
                    completionRate: 85.4,
                    averageCompletionTime: 12.5
                },
                demographics: {
                    byOrganization: [
                        { name: 'Technology', responses: 245, invited: 320 },
                        { name: 'Operations', responses: 189, invited: 280 },
                        { name: 'Marketing', responses: 156, invited: 200 },
                        { name: 'Human Resources', responses: 98, invited: 150 },
                        { name: 'Finance', responses: 87, invited: 120 },
                        { name: 'Legal', responses: 72, invited: 180 }
                    ],
                    byDepartment: [
                        { name: 'Engineering', responses: 167, invited: 220 },
                        { name: 'Product', responses: 134, invited: 180 },
                        { name: 'Sales', responses: 123, invited: 170 },
                        { name: 'Customer Success', responses: 98, invited: 130 },
                        { name: 'Design', responses: 87, invited: 110 },
                        { name: 'Data Science', responses: 76, invited: 95 }
                    ],
                    byRole: [
                        { name: 'Individual Contributor', responses: 387, invited: 520 },
                        { name: 'Team Lead', responses: 234, invited: 310 },
                        { name: 'Manager', responses: 156, invited: 230 },
                        { name: 'Senior Manager', responses: 70, invited: 120 },
                        { name: 'Director', responses: 45, invited: 70 }
                    ],
                    byTenure: [
                        { name: '0-1 years', responses: 198 },
                        { name: '1-3 years', responses: 267 },
                        { name: '3-5 years', responses: 189 },
                        { name: '5-10 years', responses: 134 },
                        { name: '10+ years', responses: 59 }
                    ]
                },
                responsePatterns: {
                    byDay: [
                        { date: '2024-01-01', responses: 45, completions: 38 },
                        { date: '2024-01-02', responses: 67, completions: 56 },
                        { date: '2024-01-03', responses: 89, completions: 73 },
                        { date: '2024-01-04', responses: 123, completions: 102 },
                        { date: '2024-01-05', responses: 156, completions: 134 },
                        { date: '2024-01-06', responses: 178, completions: 145 },
                        { date: '2024-01-07', responses: 189, completions: 175 }
                    ],
                    byHour: [
                        { hour: 8, responses: 23 }, { hour: 9, responses: 67 }, { hour: 10, responses: 89 },
                        { hour: 11, responses: 134 }, { hour: 12, responses: 76 }, { hour: 13, responses: 45 },
                        { hour: 14, responses: 123 }, { hour: 15, responses: 156 }, { hour: 16, responses: 134 },
                        { hour: 17, responses: 89 }, { hour: 18, responses: 34 }, { hour: 19, responses: 12 }
                    ],
                    dropoffPoints: [
                        { questionId: 'q1', questionTitle: 'Rate your agreement with workplace statements', dropoffRate: 8.2 },
                        { questionId: 'q5', questionTitle: 'Describe your experience with bias', dropoffRate: 15.7 },
                        { questionId: 'q12', questionTitle: 'How likely are you to recommend?', dropoffRate: 23.4 }
                    ]
                },
                sentimentAnalysis: {
                    overall: 'positive',
                    score: 72.4,
                    themes: [
                        { theme: 'Workplace Culture', frequency: 234, sentiment: 'positive' },
                        { theme: 'Management Support', frequency: 189, sentiment: 'neutral' },
                        { theme: 'Career Development', frequency: 156, sentiment: 'positive' },
                        { theme: 'Work-Life Balance', frequency: 134, sentiment: 'positive' },
                        { theme: 'Communication', frequency: 98, sentiment: 'neutral' },
                        { theme: 'Recognition', frequency: 87, sentiment: 'negative' }
                    ]
                },
                questionAnalytics: [
                    {
                        questionId: 'q1',
                        questionTitle: 'I feel like I belong in this organization',
                        questionType: 'likert-scale',
                        responses: 723,
                        avgResponseTime: 4.2,
                        satisfaction: 78.5,
                        insights: [
                            'Higher satisfaction in Technology division (84%)',
                            'Lower scores for employees with <1 year tenure (65%)',
                            'Strong correlation with manager support ratings'
                        ]
                    },
                    {
                        questionId: 'q2',
                        questionTitle: 'My colleagues treat me with respect',
                        questionType: 'likert-scale',
                        responses: 718,
                        avgResponseTime: 3.8,
                        satisfaction: 82.1,
                        insights: [
                            'Consistently high across all demographics',
                            'Slight variation by department (78-86%)',
                            'Positive trend over time'
                        ]
                    }
                ]
            });
            setLoading(false);
        };
        fetchAnalytics();
    }, [surveyId, dateRange]);
    if (loading || !analytics) {
        return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-6", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(Skeleton, { className: "w-8 h-8 rounded-lg" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx(Skeleton, { variant: "text", className: "h-6 w-20" }), _jsx(Skeleton, { variant: "text", className: "h-3 w-28" })] })] }) }, i))) }), _jsx("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: _jsx(Skeleton, { className: "h-80 w-full rounded-lg" }) })] }));
    }
    const renderOverview = () => (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-6", children: [_jsx("div", { className: "bg-blue-50 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(Users, { className: "w-8 h-8 text-blue-600" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-blue-900", children: analytics.overview.totalResponses.toLocaleString() }), _jsx("div", { className: "text-sm text-blue-700", children: "Total Responses" }), _jsxs("div", { className: "text-xs text-blue-600", children: [analytics.overview.responseRate, "% response rate"] })] })] }) }), _jsx("div", { className: "bg-green-50 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(CheckCircle, { className: "w-8 h-8 text-green-600" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-green-900", children: analytics.overview.completedResponses.toLocaleString() }), _jsx("div", { className: "text-sm text-green-700", children: "Completed" }), _jsxs("div", { className: "text-xs text-green-600", children: [analytics.overview.completionRate, "% completion rate"] })] })] }) }), _jsx("div", { className: "bg-orange-50 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(Clock, { className: "w-8 h-8 text-orange-600" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-orange-900", children: analytics.overview.inProgressResponses }), _jsx("div", { className: "text-sm text-orange-700", children: "In Progress" }), _jsx("div", { className: "text-xs text-orange-600", children: "Active participants" })] })] }) }), _jsx("div", { className: "bg-purple-50 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(TrendingUp, { className: "w-8 h-8 text-purple-600" }), _jsxs("div", { children: [_jsxs("div", { className: "text-2xl font-bold text-purple-900", children: [analytics.overview.averageCompletionTime, "m"] }), _jsx("div", { className: "text-sm text-purple-700", children: "Avg Completion Time" }), _jsx("div", { className: "text-xs text-purple-600", children: "Per respondent" })] })] }) })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Response Timeline" }), _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: analytics.responsePatterns.byDay, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "date" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "responses", stroke: "#3A7DFF", strokeWidth: 2, name: "Started" }), _jsx(Line, { type: "monotone", dataKey: "completions", stroke: "#228B22", strokeWidth: 2, name: "Completed" })] }) }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Peak Response Hours" }), _jsx("div", { className: "h-48", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: analytics.responsePatterns.byHour, children: [_jsx(XAxis, { dataKey: "hour" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "responses", fill: "#3A7DFF" })] }) }) })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Response Quality Indicators" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-gray-700", children: "Completion Rate" }), _jsxs("span", { className: "text-sm font-medium text-green-600", children: [analytics.overview.completionRate, "%"] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-gray-700", children: "Avg Response Time" }), _jsxs("span", { className: "text-sm font-medium text-blue-600", children: [analytics.overview.averageCompletionTime, " min"] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-gray-700", children: "Data Quality Score" }), _jsx("span", { className: "text-sm font-medium text-purple-600", children: "87%" })] })] })] })] })] }));
    const renderDemographics = () => (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Response by Organization" }), _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: analytics.demographics.byOrganization, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "name", angle: -45, textAnchor: "end", height: 80 }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Bar, { dataKey: "responses", fill: "#3A7DFF", name: "Responses" }), _jsx(Bar, { dataKey: "invited", fill: "#E4E7EB", name: "Invited" })] }) }) })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Response by Role" }), _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { children: [_jsx(Pie, { data: analytics.demographics.byRole, dataKey: "responses", nameKey: "name", cx: "50%", cy: "50%", outerRadius: 100, fill: "#3A7DFF", label: true, children: analytics.demographics.byRole.map((_, index) => (_jsx(Cell, { fill: COLORS[index % COLORS.length] }, `cell-${index}`))) }), _jsx(Tooltip, {}), _jsx(Legend, {})] }) }) })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Department Participation" }), _jsx("div", { className: "space-y-3", children: analytics.demographics.byDepartment.map((dept, index) => {
                                    const rate = ((dept.responses / dept.invited) * 100).toFixed(1);
                                    return (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "w-3 h-3 rounded-full", style: { backgroundColor: COLORS[index % COLORS.length] } }), _jsx("span", { className: "text-sm font-medium text-gray-900", children: dept.name })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: dept.responses }), _jsxs("div", { className: "text-xs text-gray-500", children: [rate, "% rate"] })] })] }, dept.name));
                                }) })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Response by Tenure" }), _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: analytics.demographics.byTenure, layout: "horizontal", children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { type: "number" }), _jsx(YAxis, { dataKey: "name", type: "category", width: 80 }), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "responses", fill: "#228B22" })] }) }) })] })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Response Rate Heatmap by Organization & Role" }), _jsx("div", { className: "overflow-x-auto", children: _jsx("div", { className: "min-w-full", children: _jsxs("div", { className: "grid grid-cols-6 gap-2 text-xs", children: [_jsx("div", { className: "font-medium text-gray-700" }), analytics.demographics.byRole.slice(0, 5).map(role => (_jsx("div", { className: "font-medium text-gray-700 text-center p-2", children: role.name.split(' ')[0] }, role.name))), analytics.demographics.byOrganization.slice(0, 4).map(org => (_jsxs(React.Fragment, { children: [_jsx("div", { className: "font-medium text-gray-700 p-2", children: org.name }), Array.from({ length: 5 }, (_, i) => {
                                                const rate = Math.floor(Math.random() * 40) + 50; // Mock data
                                                return (_jsxs("div", { className: `p-2 text-center rounded ${rate >= 80 ? 'bg-green-200 text-green-800' :
                                                        rate >= 60 ? 'bg-yellow-200 text-yellow-800' :
                                                            'bg-red-200 text-red-800'}`, children: [rate, "%"] }, i));
                                            })] }, org.name)))] }) }) })] })] }));
    const renderSentiment = () => (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6 text-center", children: [_jsx("div", { className: "text-4xl font-bold text-green-600 mb-2", children: analytics.sentimentAnalysis.score }), _jsx("div", { className: "text-sm text-gray-600 mb-4", children: "Overall Sentiment Score" }), _jsx("div", { className: `inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${analytics.sentimentAnalysis.overall === 'positive'
                                    ? 'bg-green-100 text-green-800'
                                    : analytics.sentimentAnalysis.overall === 'neutral'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'}`, children: analytics.sentimentAnalysis.overall.charAt(0).toUpperCase() + analytics.sentimentAnalysis.overall.slice(1) })] }), _jsxs("div", { className: "col-span-2 bg-white border border-gray-200 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Sentiment Themes" }), _jsx("div", { className: "space-y-3", children: analytics.sentimentAnalysis.themes.map((theme) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: `w-3 h-3 rounded-full ${theme.sentiment === 'positive' ? 'bg-green-400' :
                                                        theme.sentiment === 'neutral' ? 'bg-yellow-400' :
                                                            'bg-red-400'}` }), _jsx("span", { className: "font-medium text-gray-900", children: theme.theme })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("span", { className: "text-sm text-gray-600", children: [theme.frequency, " mentions"] }), _jsx("div", { className: "w-16 h-2 bg-gray-200 rounded-full", children: _jsx("div", { className: `h-2 rounded-full ${theme.sentiment === 'positive' ? 'bg-green-400' :
                                                            theme.sentiment === 'neutral' ? 'bg-yellow-400' :
                                                                'bg-red-400'}`, style: { width: `${(theme.frequency / 234) * 100}%` } }) })] })] }, theme.theme))) })] })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Theme Frequency Map" }), _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsx(Treemap, { data: analytics.sentimentAnalysis.themes.map(theme => ({
                                    name: theme.theme,
                                    size: theme.frequency,
                                    sentiment: theme.sentiment
                                })), dataKey: "size", stroke: "#fff", fill: "#3A7DFF" }) }) })] })] }));
    return (_jsxs("div", { className: "max-w-7xl mx-auto bg-white", children: [_jsxs("div", { className: "border-b border-gray-200 bg-white sticky top-0 z-10", children: [_jsx("div", { className: "px-6 py-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold text-gray-900", children: "Survey Analytics" }), _jsx("p", { className: "text-sm text-gray-600", children: analytics.surveyTitle })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("select", { value: dateRange, onChange: (e) => setDateRange(e.target.value), className: "p-2 border border-gray-300 rounded-lg text-sm", children: [_jsx("option", { value: "7d", children: "Last 7 days" }), _jsx("option", { value: "30d", children: "Last 30 days" }), _jsx("option", { value: "90d", children: "Last 90 days" }), _jsx("option", { value: "all", children: "All time" })] }), _jsxs("button", { className: "flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600", children: [_jsx(Download, { className: "w-4 h-4" }), _jsx("span", { children: "Export Report" })] })] })] }) }), _jsx("div", { className: "px-6", children: _jsx("nav", { className: "flex space-x-8", children: [
                                { id: 'overview', label: 'Overview', icon: BarChart3 },
                                { id: 'demographics', label: 'Demographics', icon: Users },
                                { id: 'patterns', label: 'Response Patterns', icon: TrendingUp },
                                { id: 'sentiment', label: 'Sentiment Analysis', icon: Map },
                                { id: 'questions', label: 'Question Analytics', icon: FileText },
                            ].map(({ id, label, icon: Icon }) => (_jsxs("button", { onClick: () => setActiveView(id), className: `flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${activeView === id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: [_jsx(Icon, { className: "w-4 h-4" }), _jsx("span", { children: label })] }, id))) }) })] }), _jsxs("div", { className: "p-6", children: [activeView === 'overview' && renderOverview(), activeView === 'demographics' && renderDemographics(), activeView === 'sentiment' && renderSentiment(), activeView === 'patterns' && (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Drop-off Analysis" }), _jsx("div", { className: "space-y-4", children: analytics.responsePatterns.dropoffPoints.map((point, index) => (_jsxs("div", { className: "flex items-center justify-between p-4 bg-gray-50 rounded-lg", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: point.questionTitle }), _jsxs("div", { className: "text-sm text-gray-600", children: ["Question ", index + 1] })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "text-lg font-semibold text-red-600", children: [point.dropoffRate, "%"] }), _jsx("div", { className: "text-xs text-gray-600", children: "Drop-off rate" })] }), point.dropoffRate > 20 && (_jsx(AlertTriangle, { className: "w-5 h-5 text-red-500" }))] })] }, point.questionId))) })] }) })), activeView === 'questions' && (_jsx("div", { className: "space-y-6", children: analytics.questionAnalytics.map((question) => (_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: question.questionTitle }), _jsxs("p", { className: "text-sm text-gray-600", children: [question.responses, " responses \u2022 ", question.avgResponseTime, "s avg time \u2022 ", question.satisfaction, "% satisfaction"] })] }), _jsx("span", { className: "px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded", children: question.questionType })] }), _jsxs("div", { className: "bg-blue-50 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-blue-900 mb-2", children: "Key Insights" }), _jsx("ul", { className: "space-y-1", children: question.insights.map((insight, index) => (_jsxs("li", { className: "text-sm text-blue-700", children: ["\u2022 ", insight] }, index))) })] })] }, question.questionId))) }))] })] }));
};
export default SurveyAnalyticsDashboard;
