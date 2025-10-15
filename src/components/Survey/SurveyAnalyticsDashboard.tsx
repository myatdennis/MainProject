import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
  Treemap
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Clock,
  Download,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Map,
  FileText
} from 'lucide-react';

interface SurveyAnalytics {
  surveyId: string;
  surveyTitle: string;
  overview: {
    totalInvited: number;
    totalResponses: number;
    completedResponses: number;
    inProgressResponses: number;
    responseRate: number;
    completionRate: number;
    averageCompletionTime: number;
  };
  demographics: {
    byOrganization: Array<{ name: string; responses: number; invited: number }>;
    byDepartment: Array<{ name: string; responses: number; invited: number }>;
    byRole: Array<{ name: string; responses: number; invited: number }>;
    byTenure: Array<{ name: string; responses: number }>;
  };
  responsePatterns: {
    byDay: Array<{ date: string; responses: number; completions: number }>;
    byHour: Array<{ hour: number; responses: number }>;
    dropoffPoints: Array<{ questionId: string; questionTitle: string; dropoffRate: number }>;
  };
  sentimentAnalysis: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number;
    themes: Array<{ theme: string; frequency: number; sentiment: 'positive' | 'neutral' | 'negative' }>;
  };
  questionAnalytics: Array<{
    questionId: string;
    questionTitle: string;
    questionType: string;
    responses: number;
    avgResponseTime: number;
    satisfaction: number;
    insights: string[];
  }>;
}

interface SurveyAnalyticsProps {
  surveyId: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

const SurveyAnalyticsDashboard: React.FC<SurveyAnalyticsProps> = ({ surveyId }) => {
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'demographics' | 'patterns' | 'sentiment' | 'questions'>('overview');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-900">{analytics.overview.totalResponses.toLocaleString()}</div>
              <div className="text-sm text-blue-700">Total Responses</div>
              <div className="text-xs text-blue-600">{analytics.overview.responseRate}% response rate</div>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-900">{analytics.overview.completedResponses.toLocaleString()}</div>
              <div className="text-sm text-green-700">Completed</div>
              <div className="text-xs text-green-600">{analytics.overview.completionRate}% completion rate</div>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <Clock className="w-8 h-8 text-orange-600" />
            <div>
              <div className="text-2xl font-bold text-orange-900">{analytics.overview.inProgressResponses}</div>
              <div className="text-sm text-orange-700">In Progress</div>
              <div className="text-xs text-orange-600">Active participants</div>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-purple-900">{analytics.overview.averageCompletionTime}m</div>
              <div className="text-sm text-purple-700">Avg Completion Time</div>
              <div className="text-xs text-purple-600">Per respondent</div>
            </div>
          </div>
        </div>
      </div>

      {/* Response Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Timeline</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.responsePatterns.byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="responses" stroke="#3B82F6" strokeWidth={2} name="Started" />
              <Line type="monotone" dataKey="completions" stroke="#10B981" strokeWidth={2} name="Completed" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Peak Response Hours</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.responsePatterns.byHour}>
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="responses" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Quality Indicators</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Completion Rate</span>
              <span className="text-sm font-medium text-green-600">{analytics.overview.completionRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Avg Response Time</span>
              <span className="text-sm font-medium text-blue-600">{analytics.overview.averageCompletionTime} min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Data Quality Score</span>
              <span className="text-sm font-medium text-purple-600">87%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDemographics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Organization */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response by Organization</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.demographics.byOrganization}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="responses" fill="#3B82F6" name="Responses" />
                <Bar dataKey="invited" fill="#E5E7EB" name="Invited" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Role */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response by Role</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.demographics.byRole}
                  dataKey="responses"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  label
                >
                  {analytics.demographics.byRole.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Department */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Participation</h3>
          <div className="space-y-3">
            {analytics.demographics.byDepartment.map((dept, index) => {
              const rate = ((dept.responses / dept.invited) * 100).toFixed(1);
              return (
                <div key={dept.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-gray-900">{dept.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{dept.responses}</div>
                    <div className="text-xs text-gray-500">{rate}% rate</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Tenure */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response by Tenure</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.demographics.byTenure} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip />
                <Bar dataKey="responses" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Response Rate Heatmap */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Rate Heatmap by Organization & Role</h3>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="grid grid-cols-6 gap-2 text-xs">
              <div className="font-medium text-gray-700"></div>
              {analytics.demographics.byRole.slice(0, 5).map(role => (
                <div key={role.name} className="font-medium text-gray-700 text-center p-2">
                  {role.name.split(' ')[0]}
                </div>
              ))}
              {analytics.demographics.byOrganization.slice(0, 4).map(org => (
                <React.Fragment key={org.name}>
                  <div className="font-medium text-gray-700 p-2">{org.name}</div>
                  {Array.from({ length: 5 }, (_, i) => {
                    const rate = Math.floor(Math.random() * 40) + 50; // Mock data
                    return (
                      <div 
                        key={i}
                        className={`p-2 text-center rounded ${
                          rate >= 80 ? 'bg-green-200 text-green-800' :
                          rate >= 60 ? 'bg-yellow-200 text-yellow-800' :
                          'bg-red-200 text-red-800'
                        }`}
                      >
                        {rate}%
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSentiment = () => (
    <div className="space-y-6">
      {/* Overall Sentiment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-green-600 mb-2">{analytics.sentimentAnalysis.score}</div>
          <div className="text-sm text-gray-600 mb-4">Overall Sentiment Score</div>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            analytics.sentimentAnalysis.overall === 'positive' 
              ? 'bg-green-100 text-green-800'
              : analytics.sentimentAnalysis.overall === 'neutral'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {analytics.sentimentAnalysis.overall.charAt(0).toUpperCase() + analytics.sentimentAnalysis.overall.slice(1)}
          </div>
        </div>

        <div className="col-span-2 bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Themes</h3>
          <div className="space-y-3">
            {analytics.sentimentAnalysis.themes.map((theme) => (
              <div key={theme.theme} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    theme.sentiment === 'positive' ? 'bg-green-400' :
                    theme.sentiment === 'neutral' ? 'bg-yellow-400' :
                    'bg-red-400'
                  }`} />
                  <span className="font-medium text-gray-900">{theme.theme}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{theme.frequency} mentions</span>
                  <div className="w-16 h-2 bg-gray-200 rounded-full">
                    <div 
                      className={`h-2 rounded-full ${
                        theme.sentiment === 'positive' ? 'bg-green-400' :
                        theme.sentiment === 'neutral' ? 'bg-yellow-400' :
                        'bg-red-400'
                      }`}
                      style={{ width: `${(theme.frequency / 234) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Theme Analysis */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Theme Frequency Map</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={analytics.sentimentAnalysis.themes.map(theme => ({
                name: theme.theme,
                size: theme.frequency,
                sentiment: theme.sentiment
              }))}
              dataKey="size"
              stroke="#fff"
              fill="#8884d8"
            />
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Survey Analytics</h1>
              <p className="text-sm text-gray-600">{analytics.surveyTitle}</p>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="p-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
              <button className="flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                <Download className="w-4 h-4" />
                <span>Export Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'demographics', label: 'Demographics', icon: Users },
              { id: 'patterns', label: 'Response Patterns', icon: TrendingUp },
              { id: 'sentiment', label: 'Sentiment Analysis', icon: Map },
              { id: 'questions', label: 'Question Analytics', icon: FileText },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveView(id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeView === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeView === 'overview' && renderOverview()}
        {activeView === 'demographics' && renderDemographics()}
        {activeView === 'sentiment' && renderSentiment()}

        {activeView === 'patterns' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Drop-off Analysis</h3>
              <div className="space-y-4">
                {analytics.responsePatterns.dropoffPoints.map((point, index) => (
                  <div key={point.questionId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{point.questionTitle}</div>
                      <div className="text-sm text-gray-600">Question {index + 1}</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-lg font-semibold text-red-600">{point.dropoffRate}%</div>
                        <div className="text-xs text-gray-600">Drop-off rate</div>
                      </div>
                      {point.dropoffRate > 20 && (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeView === 'questions' && (
          <div className="space-y-6">
            {analytics.questionAnalytics.map((question) => (
              <div key={question.questionId} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{question.questionTitle}</h3>
                    <p className="text-sm text-gray-600">
                      {question.responses} responses • {question.avgResponseTime}s avg time • {question.satisfaction}% satisfaction
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {question.questionType}
                  </span>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Key Insights</h4>
                  <ul className="space-y-1">
                    {question.insights.map((insight, index) => (
                      <li key={index} className="text-sm text-blue-700">• {insight}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyAnalyticsDashboard;