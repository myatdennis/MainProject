import React, { useState, useEffect } from 'react';
import { Users, BookOpen, TrendingUp, Activity, Eye, Clock, Zap } from 'lucide-react';

interface LiveMetrics {
  activeUsers: number;
  onlineLearners: number;
  completionsToday: number;
  averageEngagement: number;
  peakHours: { hour: number; count: number }[];
  recentActivity: Array<{
    id: string;
    user: string;
    action: string;
    course?: string;
    timestamp: Date;
  }>;
}

const RealTimeDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<LiveMetrics>({
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

  const LiveMetricCard: React.FC<{
    title: string;
    value: string | number;
    change?: string;
    icon: React.ComponentType<any>;
    color: string;
  }> = ({ title, value, change, icon: Icon, color }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className="text-sm text-green-600 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {/* Live indicator */}
      <div className="absolute top-2 right-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Real-Time Analytics</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <LiveMetricCard
          title="Active Users"
          value={metrics.activeUsers}
          change="+12% from last hour"
          icon={Users}
          color="bg-blue-500"
        />
        <LiveMetricCard
          title="Online Learners"
          value={metrics.onlineLearners}
          change="+8% from last hour"
          icon={Eye}
          color="bg-green-500"
        />
        <LiveMetricCard
          title="Completions Today"
          value={metrics.completionsToday}
          change="+15% vs yesterday"
          icon={BookOpen}
          color="bg-orange-500"
        />
        <LiveMetricCard
          title="Avg Engagement"
          value={`${metrics.averageEngagement}%`}
          change="+3% from last hour"
          icon={Activity}
          color="bg-purple-500"
        />
      </div>

      {/* Activity Heatmap */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Zap className="w-5 h-5 mr-2 text-yellow-500" />
          Activity Heatmap (24h)
        </h3>
        <div className="grid grid-cols-12 gap-1">
          {metrics.peakHours.map((hour) => (
            <div
              key={hour.hour}
              className={`h-8 rounded flex items-center justify-center text-xs font-medium ${
                hour.count > 40
                  ? 'bg-red-500 text-white'
                  : hour.count > 30
                  ? 'bg-orange-400 text-white'
                  : hour.count > 20
                  ? 'bg-yellow-400 text-gray-900'
                  : 'bg-gray-200 text-gray-600'
              }`}
              title={`${hour.hour}:00 - ${hour.count} active users`}
            >
              {hour.hour}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>Low activity</span>
          <span>High activity</span>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-blue-500" />
          Live Activity Feed
        </h3>
        <div className="space-y-3">
          {metrics.recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium text-gray-900">{activity.user}</span>
                  <span className="text-gray-600"> {activity.action}</span>
                  {activity.course && (
                    <span className="text-blue-600"> "{activity.course}"</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {activity.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RealTimeDashboard;