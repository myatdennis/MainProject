import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, Download, Filter, Calendar, Eye, MessageSquare, Target, AlertTriangle, CheckCircle, Brain, FileText, Share, RefreshCw } from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
const AdminSurveyAnalytics = () => {
    const { surveyId } = useParams();
    const [dateRange, setDateRange] = useState('all-time');
    const [filterDemographic, setFilterDemographic] = useState('all');
    // reserved for future metric selection controls
    // Sample survey data
    const surveyData = {
        id: surveyId,
        title: 'Q1 2025 Climate Assessment',
        description: 'Quarterly organizational climate and culture assessment',
        status: 'active',
        totalInvites: 247,
        totalResponses: 189,
        completionRate: 77,
        avgCompletionTime: 12,
        launchedAt: '2025-03-05',
        lastResponse: '2025-03-11'
    };
    const keyMetrics = [
        { label: 'Response Rate', value: '77%', change: '+5%', changeType: 'positive' },
        { label: 'Avg. Completion Time', value: '12 min', change: '-2 min', changeType: 'positive' },
        { label: 'Belonging Score', value: '3.8/5', change: '+0.3', changeType: 'positive' },
        { label: 'Psychological Safety', value: '3.6/5', change: '+0.1', changeType: 'positive' }
    ];
    const responsesByDemographic = [
        { category: 'Department', data: [
                { label: 'Engineering', responses: 45, percentage: 24 },
                { label: 'Marketing', responses: 38, percentage: 20 },
                { label: 'Sales', responses: 32, percentage: 17 },
                { label: 'Operations', responses: 28, percentage: 15 },
                { label: 'HR', responses: 25, percentage: 13 },
                { label: 'Finance', responses: 21, percentage: 11 }
            ] },
        { category: 'Tenure', data: [
                { label: '< 1 year', responses: 42, percentage: 22 },
                { label: '1-2 years', responses: 38, percentage: 20 },
                { label: '3-5 years', responses: 45, percentage: 24 },
                { label: '6-10 years', responses: 35, percentage: 19 },
                { label: '> 10 years', responses: 29, percentage: 15 }
            ] },
        { category: 'Role Level', data: [
                { label: 'Individual Contributor', responses: 89, percentage: 47 },
                { label: 'Team Lead', responses: 34, percentage: 18 },
                { label: 'Manager', responses: 28, percentage: 15 },
                { label: 'Director', responses: 23, percentage: 12 },
                { label: 'VP/Executive', responses: 15, percentage: 8 }
            ] }
    ];
    const questionAnalytics = [
        {
            id: 'belonging-1',
            title: 'I feel a strong sense of belonging at this organization',
            type: 'likert-scale',
            responses: 189,
            avgScore: 3.8,
            distribution: [8, 15, 32, 89, 45], // 1-5 scale
            sentiment: 'positive',
            insights: ['Strong positive trend', 'Higher scores in Engineering dept', 'Lower scores for new hires']
        },
        {
            id: 'safety-1',
            title: 'I feel safe speaking up about problems or concerns',
            type: 'likert-scale',
            responses: 187,
            avgScore: 3.6,
            distribution: [12, 23, 45, 78, 29],
            sentiment: 'neutral',
            insights: ['Room for improvement', 'Varies significantly by department', 'Tenure affects comfort level']
        },
        {
            id: 'belonging-open',
            title: 'What would make you feel a stronger sense of belonging at work?',
            type: 'open-ended',
            responses: 156,
            themes: [
                { theme: 'Flexible work arrangements', mentions: 45, sentiment: 'positive' },
                { theme: 'Better communication from leadership', mentions: 38, sentiment: 'neutral' },
                { theme: 'More diverse leadership', mentions: 32, sentiment: 'positive' },
                { theme: 'Recognition and appreciation', mentions: 28, sentiment: 'positive' },
                { theme: 'Professional development opportunities', mentions: 25, sentiment: 'positive' }
            ],
            sentimentBreakdown: { positive: 68, neutral: 22, negative: 10 }
        }
    ];
    const aiInsights = [
        {
            type: 'strength',
            title: 'Strong Belonging Foundation',
            description: 'Belonging scores are 15% above industry average, particularly strong in Engineering and Marketing departments.',
            confidence: 92,
            icon: CheckCircle,
            color: 'text-green-600',
            bgColor: 'bg-green-50'
        },
        {
            type: 'opportunity',
            title: 'Psychological Safety Gap',
            description: 'New hires (< 1 year) report 23% lower psychological safety scores. Consider enhanced onboarding support.',
            confidence: 87,
            icon: Target,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50'
        },
        {
            type: 'risk',
            title: 'Department Disparity',
            description: 'Finance department shows concerning trends with 35% lower inclusion scores than organization average.',
            confidence: 94,
            icon: AlertTriangle,
            color: 'text-red-600',
            bgColor: 'bg-red-50'
        }
    ];
    const huddleReportPreview = {
        executiveSummary: "The Q1 2025 Climate Assessment reveals a generally positive organizational culture with strong belonging scores (3.8/5) and good psychological safety (3.6/5). Key strengths include high engagement in Engineering and Marketing, while opportunities exist in supporting new hires and addressing department-specific challenges in Finance. AI analysis indicates 87% confidence in these patterns based on response clustering and sentiment analysis.",
        discussionQuestions: [
            "What specific actions can we take to improve psychological safety for new team members?",
            "How can we replicate the positive culture in Engineering across other departments?",
            "What barriers prevent people from speaking up, and how can leadership address them?",
            "How might unconscious bias be affecting our team dynamics and decision-making?",
            "What would make our organization feel more inclusive for underrepresented groups?"
        ],
        actionSteps: [
            {
                priority: 'high',
                action: 'Implement enhanced onboarding buddy system',
                owner: 'HR Leadership',
                timeline: '30 days',
                resources: ['Buddy training materials', 'Check-in templates']
            },
            {
                priority: 'medium',
                action: 'Conduct focus groups with Finance department',
                owner: 'DEI Committee',
                timeline: '45 days',
                resources: ['Focus group facilitator', 'Discussion guides']
            },
            {
                priority: 'high',
                action: 'Launch psychological safety training for managers',
                owner: 'Learning & Development',
                timeline: '60 days',
                resources: ['Training curriculum', 'Manager toolkit', 'Assessment rubric']
            },
            {
                priority: 'medium',
                action: 'Create cross-departmental mentorship program',
                owner: 'DEI Committee',
                timeline: '90 days',
                resources: ['Mentorship guidelines', 'Matching algorithm', 'Success metrics']
            }
        ],
        aiRecommendations: [
            {
                category: 'Immediate Actions',
                recommendations: [
                    'Send personalized follow-up surveys to Finance department within 2 weeks',
                    'Schedule listening sessions with new hires (< 6 months tenure)',
                    'Implement weekly check-ins between managers and direct reports'
                ]
            },
            {
                category: 'Strategic Initiatives',
                recommendations: [
                    'Develop department-specific inclusion strategies based on survey data',
                    'Create inclusion metrics dashboard for leadership team',
                    'Establish employee resource groups for underrepresented populations'
                ]
            },
            {
                category: 'Measurement & Tracking',
                recommendations: [
                    'Implement quarterly pulse surveys to track progress',
                    'Create inclusion scorecards for each department',
                    'Establish baseline metrics for future benchmarking'
                ]
            }
        ],
        riskAreas: [
            'New hire retention risk due to low psychological safety scores',
            'Potential talent flight from Finance department',
            'Communication gaps between leadership and individual contributors'
        ],
        successFactors: [
            'Strong peer relationships and team collaboration',
            'High trust in immediate supervisors',
            'Positive organizational mission alignment'
        ]
    };
    return (_jsxs("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [_jsx("div", { className: "mb-6", children: _jsx(Breadcrumbs, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Surveys', to: '/admin/surveys' }, { label: 'Analytics' }] }) }), _jsxs("div", { className: "mb-8", children: [_jsxs(Link, { to: "/admin/surveys", className: "inline-flex items-center text-[var(--hud-orange)] hover:opacity-80 mb-4 font-medium", children: [_jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back to Surveys"] }), _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: surveyData.title }), _jsx("p", { className: "text-gray-600", children: surveyData.description }), _jsxs("div", { className: "flex items-center space-x-4 mt-2 text-sm text-gray-600", children: [_jsxs("span", { children: ["Launched: ", new Date(surveyData.launchedAt).toLocaleDateString()] }), _jsx("span", { children: "\u2022" }), _jsxs("span", { children: ["Last response: ", new Date(surveyData.lastResponse).toLocaleDateString()] })] })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("button", { className: "btn-outline flex items-center space-x-2", children: [_jsx(RefreshCw, { className: "h-4 w-4" }), _jsx("span", { children: "Refresh" })] }), _jsxs("button", { className: "btn-outline flex items-center space-x-2", children: [_jsx(Share, { className: "h-4 w-4" }), _jsx("span", { children: "Share" })] }), _jsxs("button", { className: "btn-cta flex items-center space-x-2", children: [_jsx(Download, { className: "h-4 w-4" }), _jsx("span", { children: "Export Report" })] })] })] })] }), _jsx("div", { className: "card-lg card-hover mb-8", children: _jsx("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: _jsxs("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Calendar, { className: "h-5 w-5 text-gray-400" }), _jsxs("select", { value: dateRange, onChange: (e) => setDateRange(e.target.value), className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [_jsx("option", { value: "all-time", children: "All Time" }), _jsx("option", { value: "last-7-days", children: "Last 7 Days" }), _jsx("option", { value: "last-30-days", children: "Last 30 Days" }), _jsx("option", { value: "last-90-days", children: "Last 90 Days" })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Filter, { className: "h-5 w-5 text-gray-400" }), _jsxs("select", { value: filterDemographic, onChange: (e) => setFilterDemographic(e.target.value), className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Participants" }), _jsx("option", { value: "department", children: "By Department" }), _jsx("option", { value: "tenure", children: "By Tenure" }), _jsx("option", { value: "role-level", children: "By Role Level" })] })] })] }) }) }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: keyMetrics.map((metric, index) => (_jsx("div", { className: "card-lg", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: metric.label }), _jsx("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: metric.value }), _jsxs("div", { className: "flex items-center mt-2", children: [_jsx("span", { className: `text-sm font-medium ${metric.changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`, children: metric.change }), _jsx("span", { className: "text-sm text-gray-500 ml-1", children: "vs last survey" })] })] }), _jsx("div", { className: "p-3 rounded-lg bg-orange-50", children: _jsx(TrendingUp, { className: "h-6 w-6 text-orange-500" }) })] }) }, index))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8", children: [_jsxs("div", { className: "card-lg", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Response Demographics" }), _jsx("div", { className: "space-y-6", children: responsesByDemographic.map((category, index) => (_jsxs("div", { children: [_jsx("h3", { className: "font-medium text-gray-900 mb-3", children: category.category }), _jsx("div", { className: "space-y-2", children: category.data.map((item, itemIndex) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3 flex-1", children: [_jsx("span", { className: "text-sm text-gray-700 w-24", children: item.label }), _jsx("div", { className: "flex-1 bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "h-2 rounded-full", style: { width: `${item.percentage}%`, background: 'var(--gradient-blue-green)' } }) })] }), _jsxs("div", { className: "text-sm font-medium text-gray-900 ml-3", children: [item.responses, " (", item.percentage, "%)"] })] }, itemIndex))) })] }, index))) })] }), _jsxs("div", { className: "card-lg", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-6", children: [_jsx(Brain, { className: "h-6 w-6 text-purple-500" }), _jsx("h2", { className: "text-xl font-bold text-gray-900", children: "AI-Powered Insights" })] }), _jsx("div", { className: "space-y-4", children: aiInsights.map((insight, index) => {
                                    const Icon = insight.icon;
                                    return (_jsx("div", { className: `p-4 rounded-lg border ${insight.bgColor}`, children: _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx(Icon, { className: `h-5 w-5 ${insight.color} mt-0.5` }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-1", children: insight.title }), _jsx("p", { className: "text-sm text-gray-600 mb-2", children: insight.description }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-xs text-gray-500", children: ["Confidence: ", insight.confidence, "%"] }), _jsx("button", { className: `text-sm font-medium ${insight.color} hover:underline`, children: "View Details \u2192" })] })] })] }) }, index));
                                }) })] })] }), _jsxs("div", { className: "card-lg mb-8", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Question Analysis" }), _jsx("div", { className: "space-y-6", children: questionAnalytics.map((question, index) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "font-medium text-gray-900 mb-2", children: question.title }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-600", children: [_jsxs("span", { children: [question.responses, " responses"] }), question.avgScore && (_jsxs("span", { className: "font-medium", children: ["Avg: ", question.avgScore, "/5"] })), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${question.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                                                                question.sentiment === 'neutral' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-red-100 text-red-800'}`, children: question.sentiment })] })] }), _jsx("button", { className: "p-2 text-gray-400 hover:text-gray-600", children: _jsx(Eye, { className: "h-4 w-4" }) })] }), question.type === 'likert-scale' && question.distribution && (_jsx("div", { className: "mb-4", children: _jsx("div", { className: "grid grid-cols-5 gap-2", children: question.distribution.map((count, i) => (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "bg-gray-100 rounded-lg p-3 mb-1", children: _jsx("div", { className: "text-lg font-bold text-gray-900", children: count }) }), _jsx("div", { className: "text-xs text-gray-600", children: i + 1 })] }, i))) }) })), question.type === 'open-ended' && question.themes && (_jsxs("div", { className: "mb-4", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-3", children: "Key Themes" }), _jsx("div", { className: "space-y-2", children: question.themes.map((theme, themeIndex) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("span", { className: "text-sm font-medium text-gray-900", children: theme.theme }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${theme.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                                                                    theme.sentiment === 'neutral' ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-red-100 text-red-800'}`, children: theme.sentiment })] }), _jsxs("span", { className: "text-sm text-gray-600", children: [theme.mentions, " mentions"] })] }, themeIndex))) })] })), question.insights && (_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Key Insights" }), _jsx("ul", { className: "space-y-1", children: question.insights.map((insight, insightIndex) => (_jsxs("li", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-1.5 h-1.5 bg-orange-400 rounded-full" }), _jsx("span", { className: "text-sm text-gray-700", children: insight })] }, insightIndex))) })] }))] }, index))) })] }), _jsxs("div", { className: "rounded-xl p-8 mb-8", style: { background: 'var(--gradient-banner)' }, children: [_jsxs("div", { className: "flex items-center space-x-3 mb-6", children: [_jsx("div", { className: "bg-orange-500 p-3 rounded-lg", children: _jsx(FileText, { className: "h-6 w-6 text-white" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-gray-900", children: "Huddle Report Preview" }), _jsx("p", { className: "text-gray-600", children: "AI-generated team discussion guide and action plan" })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "Executive Summary" }), _jsx("p", { className: "text-gray-700 text-sm mb-6", children: huddleReportPreview.executiveSummary }), _jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "Discussion Questions" }), _jsx("ul", { className: "space-y-2", children: huddleReportPreview.discussionQuestions.map((question, index) => (_jsxs("li", { className: "flex items-start space-x-2", children: [_jsx(MessageSquare, { className: "h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" }), _jsx("span", { className: "text-sm text-gray-700", children: question })] }, index))) })] }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "Recommended Actions" }), _jsx("div", { className: "space-y-3", children: huddleReportPreview.actionSteps.map((action, index) => (_jsxs("div", { className: "bg-white p-4 rounded-lg border border-gray-200", children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsx("h4", { className: "font-medium text-gray-900 text-sm", children: action.action }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${action.priority === 'high' ? 'bg-red-100 text-red-800' :
                                                                action.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-green-100 text-green-800'}`, children: action.priority })] }), _jsxs("div", { className: "text-xs text-gray-600 space-y-1", children: [_jsxs("div", { children: ["Owner: ", action.owner] }), _jsxs("div", { children: ["Timeline: ", action.timeline] }), _jsxs("div", { children: ["Resources: ", action.resources.join(', ')] })] })] }, index))) })] })] }), _jsx("div", { className: "mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6", children: huddleReportPreview.aiRecommendations.map((category, index) => (_jsxs("div", { className: "bg-white p-4 rounded-lg border border-gray-200", children: [_jsx("h4", { className: "font-semibold text-gray-900 mb-3", children: category.category }), _jsx("ul", { className: "space-y-2", children: category.recommendations.map((rec, recIndex) => (_jsxs("li", { className: "flex items-start space-x-2", children: [_jsx(Brain, { className: "h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" }), _jsx("span", { className: "text-sm text-gray-700", children: rec })] }, recIndex))) })] }, index))) }), _jsxs("div", { className: "mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4", children: [_jsxs("h4", { className: "font-semibold text-red-900 mb-3 flex items-center space-x-2", children: [_jsx(AlertTriangle, { className: "h-5 w-5" }), _jsx("span", { children: "Risk Areas" })] }), _jsx("ul", { className: "space-y-2", children: huddleReportPreview.riskAreas.map((risk, index) => (_jsxs("li", { className: "text-sm text-red-800", children: ["\u2022 ", risk] }, index))) })] }), _jsxs("div", { className: "bg-green-50 border border-green-200 rounded-lg p-4", children: [_jsxs("h4", { className: "font-semibold text-green-900 mb-3 flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "h-5 w-5" }), _jsx("span", { children: "Success Factors" })] }), _jsx("ul", { className: "space-y-2", children: huddleReportPreview.successFactors.map((factor, index) => (_jsxs("li", { className: "text-sm text-green-800", children: ["\u2022 ", factor] }, index))) })] })] }), _jsx("div", { className: "mt-6 text-center", children: _jsxs("div", { className: "flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-3", children: [_jsxs("button", { className: "btn-outline px-6 py-3 font-medium flex items-center space-x-2", children: [_jsx(Brain, { className: "h-5 w-5" }), _jsx("span", { children: "Generate Full AI Report" })] }), _jsxs("button", { className: "btn-cta px-6 py-3 font-medium flex items-center space-x-2", children: [_jsx(Brain, { className: "h-5 w-5" }), _jsx("span", { children: "Generate Full Huddle Report" })] }), _jsxs("button", { className: "btn-outline px-6 py-3 font-medium flex items-center space-x-2", children: [_jsx(Download, { className: "h-5 w-5" }), _jsx("span", { children: "Download Executive Summary" })] })] }) })] }), _jsxs("div", { className: "card-lg mb-8", children: [_jsxs("div", { className: "flex items-center space-x-3 mb-6", children: [_jsx(Brain, { className: "h-6 w-6 text-purple-500" }), _jsx("h2", { className: "text-xl font-bold text-gray-900", children: "Advanced AI Analytics" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-4", children: "Predictive Insights" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-purple-50 border border-purple-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [_jsx(Target, { className: "h-5 w-5 text-purple-600" }), _jsx("span", { className: "font-medium text-purple-900", children: "Turnover Risk Prediction" })] }), _jsx("p", { className: "text-sm text-purple-800 mb-2", children: "AI model predicts 23% increased turnover risk in Finance department based on survey responses." }), _jsx("div", { className: "text-xs text-purple-700", children: "Confidence: 89% | Based on 247 data points" })] }), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [_jsx(TrendingUp, { className: "h-5 w-5 text-blue-600" }), _jsx("span", { className: "font-medium text-blue-900", children: "Engagement Forecast" })] }), _jsx("p", { className: "text-sm text-blue-800 mb-2", children: "Current trajectory suggests 15% improvement in overall engagement if recommended actions are implemented." }), _jsx("div", { className: "text-xs text-blue-700", children: "Confidence: 76% | 6-month projection" })] })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-4", children: "Sentiment Analysis" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-green-50 border border-green-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-green-900 mb-2", children: "Positive Themes (68%)" }), _jsxs("ul", { className: "text-sm text-green-800 space-y-1", children: [_jsx("li", { children: "\u2022 Team collaboration and support" }), _jsx("li", { children: "\u2022 Meaningful work and mission alignment" }), _jsx("li", { children: "\u2022 Growth and learning opportunities" })] })] }), _jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-yellow-900 mb-2", children: "Neutral Themes (22%)" }), _jsxs("ul", { className: "text-sm text-yellow-800 space-y-1", children: [_jsx("li", { children: "\u2022 Communication processes" }), _jsx("li", { children: "\u2022 Work-life balance policies" })] })] }), _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-red-900 mb-2", children: "Concerning Themes (10%)" }), _jsxs("ul", { className: "text-sm text-red-800 space-y-1", children: [_jsx("li", { children: "\u2022 Limited advancement opportunities" }), _jsx("li", { children: "\u2022 Inconsistent management practices" })] })] })] })] })] })] }), _jsxs("div", { className: "card-lg mb-8", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900", children: "AI-Generated Reports" }), _jsxs("button", { className: "btn-cta flex items-center space-x-2", children: [_jsx(Brain, { className: "h-4 w-4" }), _jsx("span", { children: "Generate New Report" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("button", { className: "p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 text-center group", children: [_jsx("div", { className: "bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-200 transition-colors duration-200", children: _jsx(FileText, { className: "h-6 w-6 text-blue-600" }) }), _jsx("h3", { className: "font-medium text-gray-900 mb-2", children: "Executive Summary" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "AI-generated executive summary with key findings and recommendations" }), _jsxs("div", { className: "flex items-center justify-center space-x-2 text-blue-600", children: [_jsx(Download, { className: "h-4 w-4" }), _jsx("span", { className: "text-sm font-medium", children: "Download PDF" })] })] }), _jsxs("button", { className: "p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 text-center group", children: [_jsx("div", { className: "bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 transition-colors duration-200", children: _jsx(BarChart3, { className: "h-6 w-6 text-green-600" }) }), _jsx("h3", { className: "font-medium text-gray-900 mb-2", children: "Detailed Analytics" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "Comprehensive data analysis with charts, trends, and statistical insights" }), _jsxs("div", { className: "flex items-center justify-center space-x-2 text-green-600", children: [_jsx(Download, { className: "h-4 w-4" }), _jsx("span", { className: "text-sm font-medium", children: "Download Excel" })] })] }), _jsxs("button", { className: "p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 text-center group", children: [_jsx("div", { className: "bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-orange-200 transition-colors duration-200", children: _jsx(MessageSquare, { className: "h-6 w-6 text-orange-600" }) }), _jsx("h3", { className: "font-medium text-gray-900 mb-2", children: "Team Discussion Guide" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "Facilitation guide with discussion questions and activities" }), _jsxs("div", { className: "flex items-center justify-center space-x-2 text-orange-600", children: [_jsx(Download, { className: "h-4 w-4" }), _jsx("span", { className: "text-sm font-medium", children: "Download PowerPoint" })] })] })] })] }), _jsxs("div", { className: "card-lg mb-8", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Benchmarking & Comparison" }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-4", children: "Industry Benchmarks" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: [_jsx("span", { className: "text-sm text-gray-700", children: "Belonging Score" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-900", children: "3.8" }), _jsx("span", { className: "text-xs text-gray-500", children: "vs" }), _jsx("span", { className: "text-sm text-gray-600", children: "3.2 (industry avg)" }), _jsx("span", { className: "text-xs text-green-600 font-medium", children: "+19%" })] })] }), _jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: [_jsx("span", { className: "text-sm text-gray-700", children: "Psychological Safety" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-900", children: "3.6" }), _jsx("span", { className: "text-xs text-gray-500", children: "vs" }), _jsx("span", { className: "text-sm text-gray-600", children: "3.4 (industry avg)" }), _jsx("span", { className: "text-xs text-green-600 font-medium", children: "+6%" })] })] }), _jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: [_jsx("span", { className: "text-sm text-gray-700", children: "Inclusion Index" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-900", children: "3.7" }), _jsx("span", { className: "text-xs text-gray-500", children: "vs" }), _jsx("span", { className: "text-sm text-gray-600", children: "3.5 (industry avg)" }), _jsx("span", { className: "text-xs text-green-600 font-medium", children: "+6%" })] })] })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-4", children: "Historical Trends" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-blue-900 mb-2", children: "6-Month Trend" }), _jsxs("div", { className: "text-sm text-blue-800", children: [_jsx("p", { children: "Belonging: 3.5 \u2192 3.8 (+8.6%)" }), _jsx("p", { children: "Safety: 3.4 \u2192 3.6 (+5.9%)" }), _jsx("p", { children: "Inclusion: 3.6 \u2192 3.7 (+2.8%)" })] })] }), _jsxs("div", { className: "bg-green-50 border border-green-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-green-900 mb-2", children: "Progress Indicators" }), _jsxs("div", { className: "text-sm text-green-800", children: [_jsx("p", { children: "\u2713 Consistent upward trend" }), _jsx("p", { children: "\u2713 Above industry benchmarks" }), _jsx("p", { children: "\u2713 Strong leadership engagement" })] })] })] })] })] })] }), _jsxs("div", { className: "card-lg", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Export & Sharing" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("button", { className: "p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 text-center", children: [_jsx("div", { className: "bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3", children: _jsx(FileText, { className: "h-6 w-6 text-green-600" }) }), _jsx("h3", { className: "font-medium text-gray-900 mb-2", children: "Excel Report" }), _jsx("p", { className: "text-sm text-gray-600", children: "Detailed data with charts and pivot tables" })] }), _jsxs("button", { className: "p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 text-center", children: [_jsx("div", { className: "bg-red-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3", children: _jsx(FileText, { className: "h-6 w-6 text-red-600" }) }), _jsx("h3", { className: "font-medium text-gray-900 mb-2", children: "PDF Summary" }), _jsx("p", { className: "text-sm text-gray-600", children: "Executive summary with key insights" })] }), _jsxs("button", { className: "p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 text-center", children: [_jsx("div", { className: "bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3", children: _jsx(FileText, { className: "h-6 w-6 text-blue-600" }) }), _jsx("h3", { className: "font-medium text-gray-900 mb-2", children: "PowerPoint Deck" }), _jsx("p", { className: "text-sm text-gray-600", children: "Presentation-ready slides with visuals" })] })] })] })] }));
};
export default AdminSurveyAnalytics;
