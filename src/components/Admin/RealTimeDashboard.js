import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Users, BookOpen, TrendingUp, Activity, Eye, Clock, Zap } from 'lucide-react';
const RealTimeDashboard = () => {
    const [metrics, setMetrics] = useState({
        activeUsers: 0,
        onlineLearners: 0,
        completionsToday: 0,
        averageEngagement: 0,
        peakHours: [],
        recentActivity: []
    });
    const [isConnected, setIsConnected] = useState(false);
    // Simulate real-time data updates
    useEffect(() => {
        const updateMetrics = () => {
            setMetrics({
                activeUsers: Math.floor(Math.random() * 150) + 50,
                onlineLearners: Math.floor(Math.random() * 80) + 20,
                completionsToday: Math.floor(Math.random() * 25) + 5,
                averageEngagement: Math.floor(Math.random() * 40) + 60,
                peakHours: Array.from({ length: 24 }, (_, i) => ({
                    hour: i,
                    count: Math.floor(Math.random() * 50) + 10
                })),
                recentActivity: [
                    {
                        id: '1',
                        user: 'Sarah Chen',
                        action: 'Completed lesson',
                        course: 'Inclusive Leadership',
                        timestamp: new Date(Date.now() - Math.random() * 60000)
                    },
                    {
                        id: '2',
                        user: 'Mike Johnson',
                        action: 'Started course',
                        course: 'Bias Awareness',
                        timestamp: new Date(Date.now() - Math.random() * 120000)
                    },
                    {
                        id: '3',
                        user: 'Emma Davis',
                        action: 'Earned certificate',
                        course: 'Cultural Intelligence',
                        timestamp: new Date(Date.now() - Math.random() * 180000)
                    }
                ]
            });
        };
        // Initial load
        updateMetrics();
        setIsConnected(true);
        // Update every 5 seconds
        const interval = setInterval(updateMetrics, 5000);
        return () => {
            clearInterval(interval);
            setIsConnected(false);
        };
    }, []);
    const LiveMetricCard = ({ title, value, change, icon: Icon, color }) => (_jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6 relative overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: title }), _jsx("p", { className: "text-2xl font-bold text-gray-900", children: value }), change && (_jsxs("p", { className: "text-sm text-green-600 flex items-center", children: [_jsx(TrendingUp, { className: "w-3 h-3 mr-1" }), change] }))] }), _jsx("div", { className: `p-3 rounded-lg ${color}`, children: _jsx(Icon, { className: "w-6 h-6 text-white" }) })] }), _jsx("div", { className: "absolute top-2 right-2", children: _jsx("div", { className: `w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}` }) })] }));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900", children: "Real-Time Analytics" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: `w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}` }), _jsx("span", { className: "text-sm text-gray-600", children: isConnected ? 'Live' : 'Disconnected' })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: [_jsx(LiveMetricCard, { title: "Active Users", value: metrics.activeUsers, change: "+12% from last hour", icon: Users, color: "bg-blue-500" }), _jsx(LiveMetricCard, { title: "Online Learners", value: metrics.onlineLearners, change: "+8% from last hour", icon: Eye, color: "bg-green-500" }), _jsx(LiveMetricCard, { title: "Completions Today", value: metrics.completionsToday, change: "+15% vs yesterday", icon: BookOpen, color: "bg-orange-500" }), _jsx(LiveMetricCard, { title: "Avg Engagement", value: `${metrics.averageEngagement}%`, change: "+3% from last hour", icon: Activity, color: "bg-purple-500" })] }), _jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center", children: [_jsx(Zap, { className: "w-5 h-5 mr-2 text-yellow-500" }), "Activity Heatmap (24h)"] }), _jsx("div", { className: "grid grid-cols-12 gap-1", children: metrics.peakHours.map((hour) => (_jsx("div", { className: `h-8 rounded flex items-center justify-center text-xs font-medium ${hour.count > 40
                                ? 'bg-red-500 text-white'
                                : hour.count > 30
                                    ? 'bg-orange-400 text-white'
                                    : hour.count > 20
                                        ? 'bg-yellow-400 text-gray-900'
                                        : 'bg-gray-200 text-gray-600'}`, title: `${hour.hour}:00 - ${hour.count} active users`, children: hour.hour }, hour.hour))) }), _jsxs("div", { className: "flex items-center justify-between mt-2 text-xs text-gray-500", children: [_jsx("span", { children: "Low activity" }), _jsx("span", { children: "High activity" })] })] }), _jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center", children: [_jsx(Clock, { className: "w-5 h-5 mr-2 text-blue-500" }), "Live Activity Feed"] }), _jsx("div", { className: "space-y-3", children: metrics.recentActivity.map((activity) => (_jsxs("div", { className: "flex items-center space-x-3 p-3 bg-gray-50 rounded-lg", children: [_jsx("div", { className: "w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center", children: _jsx(Users, { className: "w-4 h-4 text-blue-600" }) }), _jsxs("div", { className: "flex-1", children: [_jsxs("p", { className: "text-sm", children: [_jsx("span", { className: "font-medium text-gray-900", children: activity.user }), _jsxs("span", { className: "text-gray-600", children: [" ", activity.action] }), activity.course && (_jsxs("span", { className: "text-blue-600", children: [" \"", activity.course, "\""] }))] }), _jsx("p", { className: "text-xs text-gray-500", children: activity.timestamp.toLocaleTimeString() })] })] }, activity.id))) })] })] }));
};
export default RealTimeDashboard;
