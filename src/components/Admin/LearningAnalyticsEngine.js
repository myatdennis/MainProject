import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, BookOpen, Clock, Target, Brain, AlertTriangle } from 'lucide-react';
const LearningAnalyticsEngine = () => {
    const [activeTab, setActiveTab] = useState('engagement');
    const [timeRange, setTimeRange] = useState('30d');
    const [data, setData] = useState({
        engagement: [],
        dropoffPoints: [],
        learningPaths: [],
        skillGaps: [],
        predictions: []
    });
    // Generate mock data
    useEffect(() => {
        const generateEngagementData = () => {
            const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
            return Array.from({ length: days }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (days - i));
                return {
                    date: date.toLocaleDateString(),
                    engagement: Math.floor(Math.random() * 40) + 60,
                    completion: Math.floor(Math.random() * 30) + 70
                };
            });
        };
        setData({
            engagement: generateEngagementData(),
            dropoffPoints: [
                { lesson: 'Module 1: Introduction', dropoff: 15, difficulty: 'Easy' },
                { lesson: 'Module 2: Bias Recognition', dropoff: 35, difficulty: 'Medium' },
                { lesson: 'Module 3: Inclusive Communication', dropoff: 25, difficulty: 'Medium' },
                { lesson: 'Module 4: Advanced Scenarios', dropoff: 45, difficulty: 'Hard' },
                { lesson: 'Module 5: Assessment', dropoff: 55, difficulty: 'Hard' }
            ],
            learningPaths: [
                { path: 'Leadership Track', success: 85, avgTime: 120, satisfaction: 4.2 },
                { path: 'Manager Essentials', success: 78, avgTime: 95, satisfaction: 4.0 },
                { path: 'Individual Contributor', success: 92, avgTime: 80, satisfaction: 4.5 },
                { path: 'Executive Program', success: 68, avgTime: 200, satisfaction: 3.8 }
            ],
            skillGaps: [
                { skill: 'Inclusive Communication', current: 65, target: 85, gap: 20 },
                { skill: 'Bias Awareness', current: 72, target: 90, gap: 18 },
                { skill: 'Cultural Intelligence', current: 58, target: 80, gap: 22 },
                { skill: 'Conflict Resolution', current: 70, target: 85, gap: 15 },
                { skill: 'Team Leadership', current: 75, target: 88, gap: 13 }
            ],
            predictions: [
                { user: 'Sarah Chen', likelihood: 85, risk: 'low' },
                { user: 'Mike Johnson', likelihood: 45, risk: 'high' },
                { user: 'Emma Davis', likelihood: 70, risk: 'medium' },
                { user: 'Alex Rodriguez', likelihood: 90, risk: 'low' },
                { user: 'Lisa Thompson', likelihood: 35, risk: 'high' }
            ]
        });
    }, [timeRange]);
    const COLORS = ['#de7b12', '#3A7DFF', '#228B22', '#D72638', '#1E1E1E'];
    const getRiskColor = (risk) => {
        switch (risk) {
            case 'low': return 'text-forest bg-forest/10';
            case 'medium': return 'text-gold bg-gold/10';
            case 'high': return 'text-deepred bg-deepred/10';
            default: return 'text-slate/80 bg-cloud';
        }
    };
    const tabs = [
        { id: 'engagement', label: 'Engagement Trends', icon: TrendingUp },
        { id: 'dropoff', label: 'Drop-off Analysis', icon: AlertTriangle },
        { id: 'paths', label: 'Learning Paths', icon: Target },
        { id: 'gaps', label: 'Skill Gaps', icon: Brain },
        { id: 'predictions', label: 'Predictions', icon: Users }
    ];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-2xl font-bold text-charcoal", children: "Learning Analytics Engine" }), _jsx("div", { className: "flex items-center space-x-4", children: _jsxs("select", { value: timeRange, onChange: (e) => setTimeRange(e.target.value), className: "border border-mist rounded-lg px-3 py-2 text-sm bg-softwhite text-charcoal focus:ring-2 focus:ring-skyblue focus:outline-none", children: [_jsx("option", { value: "7d", children: "Last 7 days" }), _jsx("option", { value: "30d", children: "Last 30 days" }), _jsx("option", { value: "90d", children: "Last 90 days" })] }) })] }), _jsx("div", { className: "border-b border-mist", children: _jsx("nav", { className: "-mb-px flex space-x-8", children: tabs.map((tab) => (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${activeTab === tab.id
                            ? 'border-skyblue text-skyblue'
                            : 'border-transparent text-slate/70 hover:text-skyblue/80 hover:border-skyblue/40'}`, children: [_jsx(tab.icon, { className: "w-4 h-4" }), _jsx("span", { children: tab.label })] }, tab.id))) }) }), _jsxs("div", { className: "bg-softwhite rounded-lg border border-mist p-6 shadow-card-sm", children: [activeTab === 'engagement' && (_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-charcoal mb-4", children: "Engagement & Completion Trends" }), _jsx(ResponsiveContainer, { width: "100%", height: 400, children: _jsxs(LineChart, { data: data.engagement, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "date" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Line, { type: "monotone", dataKey: "engagement", stroke: "#3A7DFF", strokeWidth: 2, name: "Engagement %" }), _jsx(Line, { type: "monotone", dataKey: "completion", stroke: "#228B22", strokeWidth: 2, name: "Completion %" })] }) }), _jsxs("div", { className: "mt-6 grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-skyblue/10 p-4 rounded-lg", children: [_jsxs("div", { className: "flex items-center", children: [_jsx(TrendingUp, { className: "w-5 h-5 text-skyblue mr-2" }), _jsx("span", { className: "font-medium text-charcoal", children: "Engagement Up" })] }), _jsx("p", { className: "text-sm text-skyblue mt-1", children: "+12% increase in last 7 days" })] }), _jsxs("div", { className: "bg-forest/10 p-4 rounded-lg", children: [_jsxs("div", { className: "flex items-center", children: [_jsx(BookOpen, { className: "w-5 h-5 text-forest mr-2" }), _jsx("span", { className: "font-medium text-charcoal", children: "Peak Hours" })] }), _jsx("p", { className: "text-sm text-forest mt-1", children: "Most active: 10-11 AM" })] }), _jsxs("div", { className: "bg-sunrise/10 p-4 rounded-lg", children: [_jsxs("div", { className: "flex items-center", children: [_jsx(Clock, { className: "w-5 h-5 text-sunrise mr-2" }), _jsx("span", { className: "font-medium text-charcoal", children: "Avg Session" })] }), _jsx("p", { className: "text-sm text-sunrise mt-1", children: "25 minutes (+3 min)" })] })] })] })), activeTab === 'dropoff' && (_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-charcoal mb-4", children: "Learning Drop-off Points" }), _jsx(ResponsiveContainer, { width: "100%", height: 400, children: _jsxs(BarChart, { data: data.dropoffPoints, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "lesson" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "dropoff", fill: "#D72638", name: "Drop-off %" })] }) }), _jsxs("div", { className: "mt-6", children: [_jsx("h4", { className: "font-medium text-charcoal mb-3", children: "Optimization Recommendations" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-start space-x-3 p-3 bg-deepred/10 rounded-lg", children: [_jsx(AlertTriangle, { className: "w-5 h-5 text-deepred mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-deepred", children: "High Drop-off Alert" }), _jsx("p", { className: "text-sm text-deepred/80", children: "Module 5: Assessment has 55% drop-off rate. Consider breaking into smaller segments." })] })] }), _jsxs("div", { className: "flex items-start space-x-3 p-3 bg-gold/10 rounded-lg", children: [_jsx(Brain, { className: "w-5 h-5 text-gold mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-gold", children: "Content Difficulty" }), _jsx("p", { className: "text-sm text-gold/80", children: "Modules 2 & 4 show high correlation between difficulty and drop-off. Add more interactive elements." })] })] })] })] })] })), activeTab === 'paths' && (_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-charcoal mb-4", children: "Learning Path Performance" }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-slate mb-3", children: "Success Rates" }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: data.learningPaths, cx: "50%", cy: "50%", labelLine: false, label: ({ name, value }) => `${name}: ${value}%`, outerRadius: 80, fill: "#3A7DFF", dataKey: "success", nameKey: "path", children: data.learningPaths.map((_, index) => (_jsx(Cell, { fill: COLORS[index % COLORS.length] }, `cell-${index}`))) }), _jsx(Tooltip, {})] }) })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-slate mb-3", children: "Detailed Metrics" }), _jsx("div", { className: "space-y-3", children: data.learningPaths.map((path) => (_jsxs("div", { className: "border border-mist rounded-lg p-4 bg-softwhite shadow-card-sm", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h5", { className: "font-medium text-charcoal", children: path.path }), _jsxs("span", { className: `px-2 py-1 rounded text-xs font-medium ${path.success >= 85 ? 'bg-forest/15 text-forest' :
                                                                        path.success >= 70 ? 'bg-gold/15 text-gold' :
                                                                            'bg-deepred/15 text-deepred'}`, children: [path.success, "% Success"] })] }), _jsxs("div", { className: "text-sm text-slate/80", children: [_jsxs("p", { children: ["Avg Time: ", path.avgTime, " minutes"] }), _jsxs("p", { children: ["Satisfaction: ", path.satisfaction, "/5.0"] })] })] }, path.path))) })] })] })] })), activeTab === 'gaps' && (_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-charcoal mb-4", children: "Organizational Skill Gaps" }), _jsx(ResponsiveContainer, { width: "100%", height: 400, children: _jsxs(BarChart, { data: data.skillGaps, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "skill" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "current", fill: "#3A7DFF", name: "Current Level" }), _jsx(Bar, { dataKey: "target", fill: "#228B22", name: "Target Level" })] }) }), _jsxs("div", { className: "mt-6", children: [_jsx("h4", { className: "font-medium text-charcoal mb-3", children: "Priority Skills for Development" }), _jsx("div", { className: "space-y-2", children: data.skillGaps.sort((a, b) => b.gap - a.gap).map((skill) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-cloud rounded-lg shadow-card-sm", children: [_jsx("span", { className: "font-medium text-charcoal", children: skill.skill }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("span", { className: "text-sm text-slate/80", children: [skill.current, "% \u2192 ", skill.target, "%"] }), _jsxs("span", { className: `px-2 py-1 rounded text-xs font-medium ${skill.gap > 20 ? 'bg-deepred/15 text-deepred' :
                                                                skill.gap > 15 ? 'bg-gold/15 text-gold' :
                                                                    'bg-forest/15 text-forest'}`, children: [skill.gap, "% gap"] })] })] }, skill.skill))) })] })] })), activeTab === 'predictions' && (_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-charcoal mb-4", children: "Completion Predictions" }), _jsx("div", { className: "space-y-4", children: data.predictions.map((prediction) => (_jsxs("div", { className: "flex items-center justify-between p-4 border border-mist rounded-lg bg-softwhite shadow-card-sm", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "w-10 h-10 bg-skyblue/10 rounded-full flex items-center justify-center", children: _jsx(Users, { className: "w-5 h-5 text-skyblue" }) }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-charcoal", children: prediction.user }), _jsxs("p", { className: "text-sm text-slate/80", children: ["Completion likelihood: ", prediction.likelihood, "%"] })] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "w-32 bg-mist rounded-full h-2", children: _jsx("div", { className: `h-2 rounded-full ${prediction.likelihood >= 70 ? 'bg-forest' :
                                                            prediction.likelihood >= 50 ? 'bg-gold' : 'bg-deepred'}`, style: { width: `${prediction.likelihood}%` } }) }), _jsxs("span", { className: `px-2 py-1 rounded text-xs font-medium ${getRiskColor(prediction.risk)}`, children: [prediction.risk, " risk"] })] })] }, prediction.user))) }), _jsxs("div", { className: "mt-6 p-4 bg-skyblue/10 rounded-lg", children: [_jsx("h4", { className: "font-medium text-skyblue mb-2", children: "AI Recommendations" }), _jsxs("ul", { className: "text-sm text-skyblue space-y-1", children: [_jsx("li", { children: "\u2022 Send personalized encouragement to high-risk learners" }), _jsx("li", { children: "\u2022 Offer additional support for users below 50% completion likelihood" }), _jsx("li", { children: "\u2022 Create peer mentoring groups for medium-risk learners" })] })] })] }))] })] }));
};
export default LearningAnalyticsEngine;
