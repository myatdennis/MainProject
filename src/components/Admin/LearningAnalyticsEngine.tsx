import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, BookOpen, Clock, Target, Brain, AlertTriangle } from 'lucide-react';

interface AnalyticsData {
  engagement: Array<{ date: string; engagement: number; completion: number }>;
  dropoffPoints: Array<{ lesson: string; dropoff: number; difficulty: string }>;
  learningPaths: Array<{ path: string; success: number; avgTime: number; satisfaction: number }>;
  skillGaps: Array<{ skill: string; current: number; target: number; gap: number }>;
  predictions: Array<{ user: string; likelihood: number; risk: 'low' | 'medium' | 'high' }>;
}

const LearningAnalyticsEngine: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'engagement' | 'dropoff' | 'paths' | 'gaps' | 'predictions'>('engagement');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<AnalyticsData>({
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

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const tabs = [
    { id: 'engagement', label: 'Engagement Trends', icon: TrendingUp },
    { id: 'dropoff', label: 'Drop-off Analysis', icon: AlertTriangle },
    { id: 'paths', label: 'Learning Paths', icon: Target },
    { id: 'gaps', label: 'Skill Gaps', icon: Brain },
    { id: 'predictions', label: 'Predictions', icon: Users }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Learning Analytics Engine</h2>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === 'engagement' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement & Completion Trends</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data.engagement}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="engagement" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Engagement %" 
                />
                <Line 
                  type="monotone" 
                  dataKey="completion" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="Completion %" 
                />
              </LineChart>
            </ResponsiveContainer>
            
            {/* Key Insights */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-900">Engagement Up</span>
                </div>
                <p className="text-sm text-blue-700 mt-1">+12% increase in last 7 days</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <BookOpen className="w-5 h-5 text-green-600 mr-2" />
                  <span className="font-medium text-green-900">Peak Hours</span>
                </div>
                <p className="text-sm text-green-700 mt-1">Most active: 10-11 AM</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-orange-600 mr-2" />
                  <span className="font-medium text-orange-900">Avg Session</span>
                </div>
                <p className="text-sm text-orange-700 mt-1">25 minutes (+3 min)</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dropoff' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Drop-off Points</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data.dropoffPoints}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="lesson" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="dropoff" fill="#EF4444" name="Drop-off %" />
              </BarChart>
            </ResponsiveContainer>

            {/* Recommendations */}
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Optimization Recommendations</h4>
              <div className="space-y-2">
                <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">High Drop-off Alert</p>
                    <p className="text-sm text-red-700">Module 5: Assessment has 55% drop-off rate. Consider breaking into smaller segments.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                  <Brain className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">Content Difficulty</p>
                    <p className="text-sm text-yellow-700">Modules 2 & 4 show high correlation between difficulty and drop-off. Add more interactive elements.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'paths' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Path Performance</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Success Rates</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.learningPaths}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }: any) => `${name}: ${value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="success"
                      nameKey="path"
                    >
                      {data.learningPaths.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-3">Detailed Metrics</h4>
                <div className="space-y-3">
                  {data.learningPaths.map((path) => (
                    <div key={path.path} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-gray-900">{path.path}</h5>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          path.success >= 85 ? 'bg-green-100 text-green-800' :
                          path.success >= 70 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {path.success}% Success
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Avg Time: {path.avgTime} minutes</p>
                        <p>Satisfaction: {path.satisfaction}/5.0</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gaps' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Organizational Skill Gaps</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data.skillGaps}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="skill" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="current" fill="#3B82F6" name="Current Level" />
                <Bar dataKey="target" fill="#10B981" name="Target Level" />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Priority Skills for Development</h4>
              <div className="space-y-2">
                {data.skillGaps.sort((a, b) => b.gap - a.gap).map((skill) => (
                  <div key={skill.skill} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">{skill.skill}</span>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        {skill.current}% → {skill.target}%
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        skill.gap > 20 ? 'bg-red-100 text-red-800' :
                        skill.gap > 15 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {skill.gap}% gap
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'predictions' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Completion Predictions</h3>
            <div className="space-y-4">
              {data.predictions.map((prediction) => (
                <div key={prediction.user} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{prediction.user}</h4>
                      <p className="text-sm text-gray-600">Completion likelihood: {prediction.likelihood}%</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          prediction.likelihood >= 70 ? 'bg-green-500' :
                          prediction.likelihood >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${prediction.likelihood}%` }}
                      />
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(prediction.risk)}`}>
                      {prediction.risk} risk
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">AI Recommendations</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Send personalized encouragement to high-risk learners</li>
                <li>• Offer additional support for users below 50% completion likelihood</li>
                <li>• Create peer mentoring groups for medium-risk learners</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningAnalyticsEngine;