import { useState } from 'react';
import { BarChart3, TrendingUp, Download, Calendar, Filter, RefreshCw, Eye, Share } from 'lucide-react';

const AdminReports = () => {
  const [dateRange, setDateRange] = useState('last-30-days');
  const [reportType, setReportType] = useState('overview');

  const refreshReports = () => {
    console.log('Refreshing reports...');
    alert('Reports refreshed (demo)');
  };

  const exportReport = () => {
    const data = { exportedAt: new Date().toISOString(), reportType };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `report-${reportType}-${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const generateNewReport = () => {
    alert('Generating report (demo)');
  };

  const viewReport = (name: string) => {
    window.open(`/admin/report-preview?name=${encodeURIComponent(name)}`, '_blank');
  };

  const downloadReport = (name: string) => {
    const text = `Report: ${name}\nGenerated: ${new Date().toLocaleString()}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const shareReport = (name: string) => {
    const link = `${window.location.origin}/admin/reports?shared=${encodeURIComponent(name)}`;
    navigator.clipboard?.writeText(link).then(() => alert('Report link copied')).catch(() => alert('Copy not supported'));
  };

  const overviewStats = [
    { label: 'Total Learners', value: '247', change: '+12%', changeType: 'positive' },
    { label: 'Course Completions', value: '1,234', change: '+8%', changeType: 'positive' },
    { label: 'Avg. Completion Time', value: '3.2 days', change: '-15%', changeType: 'positive' },
    { label: 'Satisfaction Score', value: '4.8/5', change: '+0.2', changeType: 'positive' }
  ];

  const modulePerformance = [
    { name: 'Foundations of Inclusive Leadership', enrollments: 247, completions: 198, rate: 80, avgTime: '45 min', rating: 4.9 },
    { name: 'Empathy in Action', enrollments: 156, completions: 124, rate: 79, avgTime: '38 min', rating: 4.9 },
    { name: 'Recognizing and Mitigating Bias', enrollments: 189, completions: 142, rate: 75, avgTime: '58 min', rating: 4.8 },
    { name: 'Personal & Team Action Planning', enrollments: 98, completions: 67, rate: 68, avgTime: '35 min', rating: 4.7 },
    { name: 'Courageous Conversations at Work', enrollments: 45, completions: 23, rate: 51, avgTime: '52 min', rating: 4.6 }
  ];

  const organizationPerformance = [
    { name: 'Pacific Coast University', learners: 45, completion: 94, engagement: 'High', lastActivity: '2025-03-11' },
    { name: 'Community Impact Network', learners: 28, completion: 91, engagement: 'High', lastActivity: '2025-03-10' },
    { name: 'Regional Medical Center', learners: 67, completion: 89, engagement: 'Medium', lastActivity: '2025-03-11' },
    { name: 'Mountain View High School', learners: 23, completion: 87, engagement: 'High', lastActivity: '2025-03-09' },
    { name: 'TechForward Solutions', learners: 34, completion: 85, engagement: 'High', lastActivity: '2025-03-11' }
  ];

  const engagementData = [
    { day: 'Mon', logins: 45, completions: 12, feedback: 8 },
    { day: 'Tue', logins: 52, completions: 18, feedback: 11 },
    { day: 'Wed', logins: 38, completions: 15, feedback: 9 },
    { day: 'Thu', logins: 61, completions: 22, feedback: 14 },
    { day: 'Fri', logins: 43, completions: 16, feedback: 7 },
    { day: 'Sat', logins: 28, completions: 8, feedback: 3 },
    { day: 'Sun', logins: 31, completions: 9, feedback: 4 }
  ];

  const feedbackSummary = [
    { category: 'Content Quality', score: 4.8, responses: 156, trend: '+0.2' },
    { category: 'Ease of Use', score: 4.6, responses: 142, trend: '+0.1' },
    { category: 'Relevance', score: 4.9, responses: 168, trend: '+0.3' },
    { category: 'Support Quality', score: 4.7, responses: 89, trend: '+0.1' }
  ];

  const reports = [
    {
      name: 'Monthly Progress Report',
      description: 'Comprehensive overview of learner progress and completion rates',
      lastGenerated: '2025-03-01',
      format: 'PDF',
      size: '2.3 MB'
    },
    {
      name: 'Organization Performance',
      description: 'Detailed breakdown by organization with engagement metrics',
      lastGenerated: '2025-03-01',
      format: 'Excel',
      size: '1.8 MB'
    },
    {
      name: 'Course Analytics',
      description: 'Module-by-module analysis with completion and feedback data',
      lastGenerated: '2025-02-28',
      format: 'PDF',
      size: '3.1 MB'
    },
    {
      name: 'Learner Engagement',
      description: 'Daily and weekly engagement patterns and trends',
      lastGenerated: '2025-02-28',
      format: 'Excel',
      size: '1.2 MB'
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Analytics</h1>
        <p className="text-gray-600">Comprehensive insights into learner progress, engagement, and course effectiveness</p>
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
                <option value="last-7-days">Last 7 Days</option>
                <option value="last-30-days">Last 30 Days</option>
                <option value="last-90-days">Last 90 Days</option>
                <option value="last-year">Last Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="overview">Overview</option>
                <option value="learners">Learner Progress</option>
                <option value="courses">Course Performance</option>
                <option value="organizations">Organizations</option>
                <option value="engagement">Engagement</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button onClick={refreshReports} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 font-medium">
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button onClick={exportReport} className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {overviewStats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last period</span>
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
        {/* Module Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Module Performance</h2>
          <div className="space-y-4">
            {modulePerformance.map((module, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 text-sm">{module.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-gray-900">{module.rate}%</span>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm text-gray-600">{module.rating}</span>
                      <div className="text-yellow-400 text-sm">★</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>{module.completions}/{module.enrollments} completed</span>
                  <span>Avg: {module.avgTime}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full"
                    style={{ width: `${module.rate}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Engagement */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Weekly Engagement</h2>
          <div className="space-y-4">
            {engagementData.map((day, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 text-sm font-medium text-gray-900">{day.day}</div>
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">{day.logins} logins</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">{day.completions} completions</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">{day.feedback} feedback</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Organization Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Organization Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Organization</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Learners</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Completion Rate</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Engagement</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Last Activity</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizationPerformance.map((org, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{org.name}</div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="font-medium text-gray-900">{org.learners}</div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex flex-col items-center">
                      <div className="font-bold text-gray-900">{org.completion}%</div>
                      <div className="w-16 bg-gray-200 rounded-full h-1 mt-1">
                        <div 
                          className="bg-gradient-to-r from-green-400 to-green-500 h-1 rounded-full"
                          style={{ width: `${org.completion}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEngagementColor(org.engagement)}`}>
                      {org.engagement}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center text-sm text-gray-600">
                    {new Date(org.lastActivity).toLocaleDateString()}
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

      {/* Feedback Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Feedback Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {feedbackSummary.map((feedback, index) => (
            <div key={index} className="text-center">
              <div className="text-2xl font-bold text-gray-900 mb-1">{feedback.score}</div>
              <div className="text-sm font-medium text-gray-700 mb-1">{feedback.category}</div>
              <div className="text-xs text-gray-500 mb-2">{feedback.responses} responses</div>
              <div className="text-xs text-green-600 font-medium">{feedback.trend} vs last month</div>
            </div>
          ))}
        </div>
      </div>

      {/* Generated Reports */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Generated Reports</h2>
          <button onClick={generateNewReport} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Generate New Report</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map((report, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{report.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => viewReport(report.name)} className="p-1 text-blue-600 hover:text-blue-800" title="View">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => downloadReport(report.name)} className="p-1 text-gray-600 hover:text-gray-800" title="Download">
                    <Download className="h-4 w-4" />
                  </button>
                  <button onClick={() => shareReport(report.name)} className="p-1 text-gray-600 hover:text-gray-800" title="Share">
                    <Share className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Generated: {new Date(report.lastGenerated).toLocaleDateString()}</span>
                <span>{report.format} • {report.size}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminReports;