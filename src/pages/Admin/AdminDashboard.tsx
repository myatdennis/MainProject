import { useNavigate } from 'react-router-dom';
import SEO from '../../components/SEO/SEO';
import { 
  Users, 
  Building2, 
  BookOpen, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Award,
  BarChart3,
  MessageSquare,
  Download
} from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const handleExportReport = async () => {
    try {
      // Create comprehensive report data
      const reportData = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalLearners: 247,
          activeOrganizations: 18,
          courseCompletions: 1234,
          averageCompletionRate: 87
        },
        modulePerformance,
        recentActivity,
        alerts
      };

      // Convert to CSV format
      const csvContent = [
        'Module Performance Report',
        `Generated: ${new Date().toLocaleDateString()}`,
        '',
        'Module Name,Completion Rate,Average Time',
        ...modulePerformance.map(module => 
          `"${module.name}","${module.completion}%","${module.avgTime}"`
        ),
        '',
        'Summary Statistics',
        `Total Learners,${reportData.summary.totalLearners}`,
        `Active Organizations,${reportData.summary.activeOrganizations}`,
        `Course Completions,${reportData.summary.courseCompletions}`,
        `Average Completion Rate,${reportData.summary.averageCompletionRate}%`
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-dashboard-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('Dashboard report exported successfully');
    } catch (error) {
      console.error('Failed to export dashboard report:', error);
    }
  };

  const stats = [
    { 
      label: 'Active Learners', 
      value: '247', 
      change: '+12%', 
      changeType: 'positive',
      icon: Users, 
      color: 'text-blue-500',
      bgColor: 'bg-blue-50'
    },
    { 
      label: 'Organizations', 
      value: '18', 
      change: '+2', 
      changeType: 'positive',
      icon: Building2, 
      color: 'text-green-500',
      bgColor: 'bg-green-50'
    },
    { 
      label: 'Course Completions', 
      value: '1,234', 
      change: '+8%', 
      changeType: 'positive',
      icon: Award, 
      color: 'text-orange-500',
      bgColor: 'bg-orange-50'
    },
    { 
      label: 'Avg. Completion Rate', 
      value: '87%', 
      change: '-3%', 
      changeType: 'negative',
      icon: TrendingUp, 
      color: 'text-purple-500',
      bgColor: 'bg-purple-50'
    }
  ];

  const recentActivity = [
    {
      type: 'completion',
      user: 'Sarah Chen',
      org: 'Pacific Coast University',
      action: 'Completed "Foundations of Inclusive Leadership"',
      time: '2 hours ago',
      icon: CheckCircle,
      color: 'text-green-500'
    },
    {
      type: 'enrollment',
      user: 'Marcus Rodriguez',
      org: 'Mountain View High School',
      action: 'Enrolled in "Courageous Conversations"',
      time: '4 hours ago',
      icon: Users,
      color: 'text-blue-500'
    },
    {
      type: 'feedback',
      user: 'Jennifer Walsh',
      org: 'Community Impact Network',
      action: 'Submitted course feedback',
      time: '6 hours ago',
      icon: MessageSquare,
      color: 'text-purple-500'
    },
    {
      type: 'overdue',
      user: 'David Thompson',
      org: 'Regional Fire Department',
      action: 'Module overdue: "Recognizing Bias"',
      time: '1 day ago',
      icon: AlertTriangle,
      color: 'text-red-500'
    }
  ];

  const alerts = [
    {
      type: 'warning',
      title: '15 learners have overdue modules',
      description: 'Send reminder notifications to improve completion rates',
      action: 'Send Reminders',
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    {
      type: 'info',
      title: 'New organization pending approval',
      description: 'TechForward Solutions has requested access',
      action: 'Review Request',
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      type: 'success',
      title: 'Monthly report ready',
      description: 'February analytics report is available for download',
      action: 'Download Report',
      icon: BarChart3,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    }
  ];

  const topPerformingOrgs = [
    { name: 'Pacific Coast University', completion: 94, learners: 45 },
    { name: 'Community Impact Network', completion: 91, learners: 28 },
    { name: 'Regional Medical Center', completion: 89, learners: 67 },
    { name: 'Mountain View High School', completion: 87, learners: 23 },
    { name: 'TechForward Solutions', completion: 85, learners: 34 }
  ];

  const modulePerformance = [
    { name: 'Foundations of Inclusive Leadership', completion: 92, avgTime: '45 min' },
    { name: 'Empathy in Action', completion: 89, avgTime: '38 min' },
    { name: 'Courageous Conversations', completion: 84, avgTime: '52 min' },
    { name: 'Recognizing and Mitigating Bias', completion: 81, avgTime: '58 min' },
    { name: 'Personal & Team Action Planning', completion: 78, avgTime: '35 min' }
  ];

  return (
    <>
      <SEO 
        title="Admin Dashboard"
        description="Monitor learner progress, manage organizations, and track inclusive leadership training effectiveness with comprehensive analytics and insights."
        keywords={['admin dashboard', 'learning analytics', 'progress tracking', 'organizational metrics', 'training management']}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          'name': 'Admin Dashboard',
          'description': 'Comprehensive admin dashboard for managing inclusive leadership training programs',
          'breadcrumb': {
            '@type': 'BreadcrumbList',
            'itemListElement': [
              {
                '@type': 'ListItem',
                'position': 1,
                'name': 'Admin Portal',
                'item': '/admin'
              },
              {
                '@type': 'ListItem', 
                'position': 2,
                'name': 'Dashboard',
                'item': '/admin/dashboard'
              }
            ]
          }
        }}
      />
      
      <div className="p-6 max-w-7xl mx-auto">
        {/* AdminDashboard mounted (debug banner removed) */}
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Monitor learner progress, manage organizations, and track training effectiveness</p>
        </div>

      {/* Stats Grid */}
      <section aria-labelledby="stats-heading" className="mb-8">
        <h2 id="stats-heading" className="sr-only">Key Performance Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={index} 
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
              role="article"
              aria-labelledby={`stat-${index}-label`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p id={`stat-${index}-label`} className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <div className="flex items-center mt-2">
                    <span className={`text-sm font-medium ${
                      stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">vs last month</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`} aria-hidden="true">
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </section>

      {/* Alerts */}
      <section aria-labelledby="alerts-heading" className="mb-8">
        <h2 id="alerts-heading" className="text-xl font-bold text-gray-900 mb-4">Alerts & Actions</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {alerts.map((alert, index) => {
            const Icon = alert.icon;
            return (
              <div key={index} className={`p-4 rounded-lg border ${alert.borderColor} ${alert.bgColor}`}>
                <div className="flex items-start space-x-3">
                  <Icon className={`h-5 w-5 ${alert.color} mt-0.5`} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{alert.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                    <button className={`mt-2 text-sm font-medium ${alert.color} hover:underline`}>
                      {alert.action} →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => {
              const Icon = activity.icon;
              return (
                <div key={index} className="flex items-start space-x-3">
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <Icon className={`h-4 w-4 ${activity.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.user} <span className="font-normal text-gray-600">({activity.org})</span>
                    </p>
                    <p className="text-sm text-gray-600">{activity.action}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="w-full mt-4 text-center text-sm text-orange-500 hover:text-orange-600 font-medium">
            View All Activity →
          </button>
        </div>

        {/* Top Performing Organizations */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Top Performing Organizations</h2>
          <div className="space-y-4">
            {topPerformingOrgs.map((org, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{org.name}</h3>
                  <p className="text-sm text-gray-600">{org.learners} learners</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{org.completion}%</div>
                  <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full"
                      style={{ width: `${org.completion}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module Performance */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Module Performance</h2>
          <button 
            onClick={handleExportReport}
            className="flex items-center space-x-2 text-orange-500 hover:text-orange-600 font-medium transition-colors duration-200"
            title="Export dashboard performance report as CSV"
          >
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Module Name</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Completion Rate</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Avg. Time</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Progress</th>
              </tr>
            </thead>
            <tbody>
              {modulePerformance.map((module, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{module.name}</div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="font-semibold text-gray-900">{module.completion}%</span>
                  </td>
                  <td className="py-4 px-4 text-center text-gray-600">{module.avgTime}</td>
                  <td className="py-4 px-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full"
                        style={{ width: `${module.completion}%` }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <button 
          onClick={() => navigate('/admin/users')}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Users className="h-8 w-8 mb-3" />
          <h3 className="font-bold text-lg mb-2">Manage Users</h3>
          <p className="text-blue-100 text-sm">Add, edit, or assign courses to learners</p>
        </button>
        <button 
          onClick={() => navigate('/admin/course-builder/new')}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          <BookOpen className="h-8 w-8 mb-3" />
          <h3 className="font-bold text-lg mb-2">Course Builder</h3>
          <p className="text-green-100 text-sm">Create and customize training modules</p>
        </button>
        <button 
          onClick={() => navigate('/admin/analytics')}
          className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
        >
          <BarChart3 className="h-8 w-8 mb-3" />
          <h3 className="font-bold text-lg mb-2">Analytics</h3>
          <p className="text-orange-100 text-sm">View detailed reports and insights</p>
        </button>
      </div>
      </div>
    </>
  );
};

export default AdminDashboard;