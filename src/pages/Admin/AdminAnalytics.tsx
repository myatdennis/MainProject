import React, { useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  BookOpen, 
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Brain,
  Download,
  Filter,
  Calendar,
  RefreshCw,
  Eye,
  MessageSquare,
  Zap
} from 'lucide-react';

const AdminAnalytics = () => {
  const [dateRange, setDateRange] = useState('last-30-days');
  const [selectedMetric, setSelectedMetric] = useState('engagement');

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

  const getEngagementColor = (engagement: string) => {
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

  const getHeatmapColor = (value: number) => {
    if (value === 0) return 'bg-gray-100';
    if (value <= 5) return 'bg-blue-100';
    if (value <= 10) return 'bg-blue-200';
    if (value <= 15) return 'bg-blue-300';
    if (value <= 20) return 'bg-blue-400';
    if (value <= 25) return 'bg-blue-500';
    return 'bg-blue-600';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Advanced Analytics & AI Insights</h1>
        <p className="text-gray-600">AI-powered analytics to optimize learning experiences and predict outcomes</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="last-7-days">Last 7 Days</option>
                <option value="last-30-days">Last 30 Days</option>
                <option value="last-90-days">Last 90 Days</option>
                <option value="last-year">Last Year</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="engagement">Engagement Analysis</option>
                <option value="performance">Performance Metrics</option>
                <option value="predictive">Predictive Analytics</option>
                <option value="content">Content Analysis</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 font-medium">
              <RefreshCw className="h-4 w-4" />
              <span>Refresh AI Analysis</span>
            </button>
            <button className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export Insights</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-6">
          <Brain className="h-6 w-6 text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900">AI-Powered Insights</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {aiInsights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <div key={index} className={`p-6 rounded-lg border ${insight.borderColor} ${insight.bgColor}`}>
                <div className="flex items-start space-x-3 mb-4">
                  <Icon className={`h-6 w-6 ${insight.color} mt-0.5`} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{insight.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{insight.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Confidence: {insight.confidence}%</span>
                      <button className={`text-sm font-medium ${insight.color} hover:underline`}>
                        {insight.action} →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Predictive Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {predictiveMetrics.map((metric, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${metric.color}`}>
                    {metric.trend}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last period</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-purple-50">
                <Brain className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Engagement Heatmap */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Engagement Heatmap</h2>
          <div className="space-y-2">
            <div className="grid grid-cols-13 gap-1 text-xs text-gray-500 mb-2">
              <div></div>
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="text-center">{i === 0 ? '12a' : i < 12 ? `${i}a` : '12p'}</div>
              ))}
            </div>
            {engagementHeatmap.map((day, dayIndex) => (
              <div key={dayIndex} className="grid grid-cols-13 gap-1">
                <div className="text-xs text-gray-500 py-1">{day.day}</div>
                {day.hours.map((value, hourIndex) => (
                  <div
                    key={hourIndex}
                    className={`h-4 rounded-sm ${getHeatmapColor(value)}`}
                    title={`${day.day} ${hourIndex}:00 - ${value} active learners`}
                  ></div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
            <span>Less active</span>
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-gray-100 rounded-sm"></div>
              <div className="w-3 h-3 bg-blue-100 rounded-sm"></div>
              <div className="w-3 h-3 bg-blue-300 rounded-sm"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
            </div>
            <span>More active</span>
          </div>
        </div>

        {/* Learner Journey */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Learner Journey Analysis</h2>
          <div className="space-y-4">
            {learnerJourney.map((stage, index) => (
              <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{stage.stage}</div>
                  <div className="text-sm text-gray-600">{stage.users} users • Avg: {stage.avgTime}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{stage.conversion}%</div>
                  <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full"
                      style={{ width: `${stage.conversion}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Content Performance Analysis</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Content</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Views</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Completion</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Avg. Time</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Engagement</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Rating</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contentPerformance.map((content, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{content.content}</div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="font-medium text-gray-900">{content.views}</div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="font-medium text-gray-900">{content.completion}%</div>
                  </td>
                  <td className="py-4 px-4 text-center text-gray-600">
                    {content.avgWatchTime}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEngagementColor(content.engagement)}`}>
                      {content.engagement}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="font-medium text-gray-900">{content.feedback}</span>
                      <div className="text-yellow-400">★</div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button className="p-1 text-blue-600 hover:text-blue-800" title="View Details">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-8">
        <div className="flex items-center space-x-3 mb-6">
          <Zap className="h-6 w-6 text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900">AI Recommendations</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Optimize Content</h3>
            <p className="text-sm text-gray-600 mb-3">Break down "Conversation Template" into smaller, interactive segments to improve engagement.</p>
            <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">Apply Suggestion →</button>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Schedule Reminders</h3>
            <p className="text-sm text-gray-600 mb-3">Send personalized reminders to 23 at-risk learners on Tuesday mornings for optimal engagement.</p>
            <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">Schedule Now →</button>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Create Cohort</h3>
            <p className="text-sm text-gray-600 mb-3">Group high-performing learners for peer mentoring to boost overall completion rates.</p>
            <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">Create Group →</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;