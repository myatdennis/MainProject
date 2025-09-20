import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft,
  BarChart3,
  Users,
  TrendingUp,
  Download,
  Filter,
  Calendar,
  Eye,
  MessageSquare,
  Target,
  AlertTriangle,
  CheckCircle,
  Brain,
  Zap,
  FileText,
  Share,
  RefreshCw
} from 'lucide-react';

const AdminSurveyAnalytics = () => {
  const { surveyId } = useParams();
  const [dateRange, setDateRange] = useState('all-time');
  const [filterDemographic, setFilterDemographic] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('overview');

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
    ]},
    { category: 'Tenure', data: [
      { label: '< 1 year', responses: 42, percentage: 22 },
      { label: '1-2 years', responses: 38, percentage: 20 },
      { label: '3-5 years', responses: 45, percentage: 24 },
      { label: '6-10 years', responses: 35, percentage: 19 },
      { label: '> 10 years', responses: 29, percentage: 15 }
    ]},
    { category: 'Role Level', data: [
      { label: 'Individual Contributor', responses: 89, percentage: 47 },
      { label: 'Team Lead', responses: 34, percentage: 18 },
      { label: 'Manager', responses: 28, percentage: 15 },
      { label: 'Director', responses: 23, percentage: 12 },
      { label: 'VP/Executive', responses: 15, percentage: 8 }
    ]}
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
    executiveSummary: "The Q1 2025 Climate Assessment reveals a generally positive organizational culture with strong belonging scores (3.8/5) and good psychological safety (3.6/5). Key strengths include high engagement in Engineering and Marketing, while opportunities exist in supporting new hires and addressing department-specific challenges in Finance.",
    discussionQuestions: [
      "What specific actions can we take to improve psychological safety for new team members?",
      "How can we replicate the positive culture in Engineering across other departments?",
      "What barriers prevent people from speaking up, and how can leadership address them?"
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
      }
    ]
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          to="/admin/surveys" 
          className="inline-flex items-center text-orange-500 hover:text-orange-600 mb-4 font-medium"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Surveys
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{surveyData.title}</h1>
            <p className="text-gray-600">{surveyData.description}</p>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
              <span>Launched: {new Date(surveyData.launchedAt).toLocaleDateString()}</span>
              <span>•</span>
              <span>Last response: {new Date(surveyData.lastResponse).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2">
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2">
              <Share className="h-4 w-4" />
              <span>Share</span>
            </button>
            <button className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
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
                <option value="all-time">All Time</option>
                <option value="last-7-days">Last 7 Days</option>
                <option value="last-30-days">Last 30 Days</option>
                <option value="last-90-days">Last 90 Days</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterDemographic}
                onChange={(e) => setFilterDemographic(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Participants</option>
                <option value="department">By Department</option>
                <option value="tenure">By Tenure</option>
                <option value="role-level">By Role Level</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {keyMetrics.map((metric, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${
                    metric.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.change}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last survey</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-orange-50">
                <TrendingUp className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Response Demographics */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Response Demographics</h2>
          <div className="space-y-6">
            {responsesByDemographic.map((category, index) => (
              <div key={index}>
                <h3 className="font-medium text-gray-900 mb-3">{category.category}</h3>
                <div className="space-y-2">
                  {category.data.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <span className="text-sm text-gray-700 w-24">{item.label}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full"
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-900 ml-3">
                        {item.responses} ({item.percentage}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Brain className="h-6 w-6 text-purple-500" />
            <h2 className="text-xl font-bold text-gray-900">AI-Powered Insights</h2>
          </div>
          <div className="space-y-4">
            {aiInsights.map((insight, index) => {
              const Icon = insight.icon;
              return (
                <div key={index} className={`p-4 rounded-lg border ${insight.bgColor}`}>
                  <div className="flex items-start space-x-3">
                    <Icon className={`h-5 w-5 ${insight.color} mt-0.5`} />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{insight.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Confidence: {insight.confidence}%</span>
                        <button className={`text-sm font-medium ${insight.color} hover:underline`}>
                          View Details →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Question-by-Question Analysis */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Question Analysis</h2>
        <div className="space-y-6">
          {questionAnalytics.map((question, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-2">{question.title}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>{question.responses} responses</span>
                    {question.avgScore && (
                      <span className="font-medium">Avg: {question.avgScore}/5</span>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      question.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                      question.sentiment === 'neutral' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {question.sentiment}
                    </span>
                  </div>
                </div>
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <Eye className="h-4 w-4" />
                </button>
              </div>

              {question.type === 'likert-scale' && question.distribution && (
                <div className="mb-4">
                  <div className="grid grid-cols-5 gap-2">
                    {question.distribution.map((count, i) => (
                      <div key={i} className="text-center">
                        <div className="bg-gray-100 rounded-lg p-3 mb-1">
                          <div className="text-lg font-bold text-gray-900">{count}</div>
                        </div>
                        <div className="text-xs text-gray-600">{i + 1}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {question.type === 'open-ended' && question.themes && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-3">Key Themes</h4>
                  <div className="space-y-2">
                    {question.themes.map((theme, themeIndex) => (
                      <div key={themeIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-gray-900">{theme.theme}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            theme.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                            theme.sentiment === 'neutral' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {theme.sentiment}
                          </span>
                        </div>
                        <span className="text-sm text-gray-600">{theme.mentions} mentions</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {question.insights && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Key Insights</h4>
                  <ul className="space-y-1">
                    {question.insights.map((insight, insightIndex) => (
                      <li key={insightIndex} className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                        <span className="text-sm text-gray-700">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Huddle Report Preview */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-8 mb-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-orange-500 p-3 rounded-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Huddle Report Preview</h2>
            <p className="text-gray-600">AI-generated team discussion guide and action plan</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Executive Summary</h3>
            <p className="text-gray-700 text-sm mb-6">{huddleReportPreview.executiveSummary}</p>
            
            <h3 className="font-semibold text-gray-900 mb-3">Discussion Questions</h3>
            <ul className="space-y-2">
              {huddleReportPreview.discussionQuestions.map((question, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{question}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Recommended Actions</h3>
            <div className="space-y-3">
              {huddleReportPreview.actionSteps.map((action, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">{action.action}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      action.priority === 'high' ? 'bg-red-100 text-red-800' :
                      action.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {action.priority}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Owner: {action.owner}</div>
                    <div>Timeline: {action.timeline}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button className="bg-white text-orange-500 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 border border-orange-500 font-medium">
            Generate Full Huddle Report
          </button>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Export & Sharing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button className="p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 text-center">
            <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Excel Report</h3>
            <p className="text-sm text-gray-600">Detailed data with charts and pivot tables</p>
          </button>
          
          <button className="p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 text-center">
            <div className="bg-red-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">PDF Summary</h3>
            <p className="text-sm text-gray-600">Executive summary with key insights</p>
          </button>
          
          <button className="p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">PowerPoint Deck</h3>
            <p className="text-sm text-gray-600">Presentation-ready slides with visuals</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSurveyAnalytics;