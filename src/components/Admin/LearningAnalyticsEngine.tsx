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

  const COLORS = ['#F28C1A', '#2B84C6', '#3BAA66', '#E6473A', '#1E1E1E'];

  const getRiskColor = (risk: string) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-charcoal">Learning Analytics Engine</h2>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="border border-mist rounded-lg px-3 py-2 text-sm bg-softwhite text-charcoal focus:ring-2 focus:ring-skyblue focus:outline-none"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-mist">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-skyblue text-skyblue'
                  : 'border-transparent text-slate/70 hover:text-skyblue/80 hover:border-skyblue/40'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-softwhite rounded-lg border border-mist p-6 shadow-card-sm">
        {activeTab === 'engagement' && (
          <div>
            <h3 className="text-lg font-semibold text-charcoal mb-4">Engagement & Completion Trends</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data.engagement}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="engagement" 
                  stroke="#2B84C6" 
                  strokeWidth={2}
                  name="Engagement %" 
                />
                <Line 
                  type="monotone" 
                  dataKey="completion" 
                  stroke="#3BAA66" 
                  strokeWidth={2}
                  name="Completion %" 
                />
              </LineChart>
            </ResponsiveContainer>
            
            {/* Key Insights */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-skyblue/10 p-4 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="w-5 h-5 text-skyblue mr-2" />
                  <span className="font-medium text-charcoal">Engagement Up</span>
                </div>
                <p className="text-sm text-skyblue mt-1">+12% increase in last 7 days</p>
              </div>
              <div className="bg-forest/10 p-4 rounded-lg">
                <div className="flex items-center">
                  <BookOpen className="w-5 h-5 text-forest mr-2" />
                  <span className="font-medium text-charcoal">Peak Hours</span>
                </div>
                <p className="text-sm text-forest mt-1">Most active: 10-11 AM</p>
              </div>
              <div className="bg-sunrise/10 p-4 rounded-lg">
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-sunrise mr-2" />
                  <span className="font-medium text-charcoal">Avg Session</span>
                </div>
                <p className="text-sm text-sunrise mt-1">25 minutes (+3 min)</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dropoff' && (
          <div>
            <h3 className="text-lg font-semibold text-charcoal mb-4">Learning Drop-off Points</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data.dropoffPoints}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="lesson" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="dropoff" fill="#E6473A" name="Drop-off %" />
              </BarChart>
            </ResponsiveContainer>

            {/* Recommendations */}
            <div className="mt-6">
              <h4 className="font-medium text-charcoal mb-3">Optimization Recommendations</h4>
              <div className="space-y-2">
                <div className="flex items-start space-x-3 p-3 bg-deepred/10 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-deepred mt-0.5" />
                  <div>
                    <p className="font-medium text-deepred">High Drop-off Alert</p>
                    <p className="text-sm text-deepred/80">Module 5: Assessment has 55% drop-off rate. Consider breaking into smaller segments.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-gold/10 rounded-lg">
                  <Brain className="w-5 h-5 text-gold mt-0.5" />
                  <div>
                    <p className="font-medium text-gold">Content Difficulty</p>
                    <p className="text-sm text-gold/80">Modules 2 & 4 show high correlation between difficulty and drop-off. Add more interactive elements.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'paths' && (
          <div>
            <h3 className="text-lg font-semibold text-charcoal mb-4">Learning Path Performance</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-slate mb-3">Success Rates</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.learningPaths}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }: any) => `${name}: ${value}%`}
                      outerRadius={80}
                      fill="#2B84C6"
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
                <h4 className="font-medium text-slate mb-3">Detailed Metrics</h4>
                <div className="space-y-3">
                  {data.learningPaths.map((path) => (
                    <div key={path.path} className="border border-mist rounded-lg p-4 bg-softwhite shadow-card-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-charcoal">{path.path}</h5>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          path.success >= 85 ? 'bg-forest/15 text-forest' :
                          path.success >= 70 ? 'bg-gold/15 text-gold' :
                          'bg-deepred/15 text-deepred'
                        }`}>
                          {path.success}% Success
                        </span>
                      </div>
                      <div className="text-sm text-slate/80">
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
            <h3 className="text-lg font-semibold text-charcoal mb-4">Organizational Skill Gaps</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data.skillGaps}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="skill" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="current" fill="#2B84C6" name="Current Level" />
                <Bar dataKey="target" fill="#3BAA66" name="Target Level" />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-6">
              <h4 className="font-medium text-charcoal mb-3">Priority Skills for Development</h4>
              <div className="space-y-2">
                {data.skillGaps.sort((a, b) => b.gap - a.gap).map((skill) => (
                  <div key={skill.skill} className="flex items-center justify-between p-3 bg-cloud rounded-lg shadow-card-sm">
                    <span className="font-medium text-charcoal">{skill.skill}</span>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-slate/80">
                        {skill.current}% → {skill.target}%
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        skill.gap > 20 ? 'bg-deepred/15 text-deepred' :
                        skill.gap > 15 ? 'bg-gold/15 text-gold' :
                        'bg-forest/15 text-forest'
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
            <h3 className="text-lg font-semibold text-charcoal mb-4">Completion Predictions</h3>
            <div className="space-y-4">
              {data.predictions.map((prediction) => (
                <div key={prediction.user} className="flex items-center justify-between p-4 border border-mist rounded-lg bg-softwhite shadow-card-sm">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-skyblue/10 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-skyblue" />
                    </div>
                    <div>
                      <h4 className="font-medium text-charcoal">{prediction.user}</h4>
                      <p className="text-sm text-slate/80">Completion likelihood: {prediction.likelihood}%</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-32 bg-mist rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          prediction.likelihood >= 70 ? 'bg-forest' :
                          prediction.likelihood >= 50 ? 'bg-gold' : 'bg-deepred'
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

            <div className="mt-6 p-4 bg-skyblue/10 rounded-lg">
              <h4 className="font-medium text-skyblue mb-2">AI Recommendations</h4>
              <ul className="text-sm text-skyblue space-y-1">
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
