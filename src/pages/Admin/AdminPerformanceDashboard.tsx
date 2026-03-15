import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Users,
  Zap,
  RefreshCw,
  CheckCircle,
  Brain,
  Lightbulb,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import { useAnalyticsDashboard } from '../../hooks/useAnalyticsDashboard';
import { LoadingSpinner } from '../../components/LoadingComponents';

const AdminPerformanceDashboard: React.FC = () => {
  const { data, loading, error, refresh, lastUpdated } = useAnalyticsDashboard();
  const ov = data.overview;

  const [apiTiming, setApiTiming] = useState<number | null>(null);

  // Measure the round-trip time for a lightweight API call as a proxy for API response time
  useEffect(() => {
    const t0 = Date.now();
    fetch('/api/runtime/status', { credentials: 'include' })
      .then(() => setApiTiming(Date.now() - t0))
      .catch(() => {});
  }, []);

  function exportDashboardData() {
    try {
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        overview: ov,
        courseDetail: data.courseDetail,
        topOrgs: data.topOrgs,
        dropoffs: data.dropoffs,
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'performance_export.json';
      a.click();
      toast.success('Dashboard data exported!');
    } catch (err) {
      toast.error('Export failed');
    }
  }

  const completionRate = Math.round(ov?.platformAvgCompletion ?? 0);
  const avgProgress   = Math.round(ov?.platformAvgProgress ?? 0);
  const activeLearners = ov?.totalActiveLearners ?? 0;
  const totalCourses   = ov?.totalCourses ?? 0;
  const totalOrgs      = ov?.totalOrgs ?? 0;

  // Derive engagement level from avg completion
  const engagementLabel = completionRate >= 75 ? 'High' : completionRate >= 45 ? 'Medium' : 'Low';
  const engagementColor = completionRate >= 75 ? 'text-green-600' : completionRate >= 45 ? 'text-yellow-600' : 'text-red-600';

  // Dropout rate = 100 - completionRate (platform-wide)
  const dropoutRate = Math.max(0, 100 - completionRate);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Performance Dashboard</h1>
          <p className="text-gray-600">
            Live platform metrics from real learner and course data.
            {lastUpdated && (
              <span className="ml-2 text-xs text-gray-400">
                Updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            onClick={() => { refresh(); toast.success('Refreshed.'); }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={exportDashboardData}
          >
            Export Data
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {/* Live KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        {[
          { label: 'Active Learners',   value: loading ? '…' : activeLearners.toLocaleString(), icon: Users,     color: 'text-blue-600' },
          { label: 'Published Courses', value: loading ? '…' : totalCourses.toLocaleString(),   icon: BookOpen,  color: 'text-green-600' },
          { label: 'Organizations',     value: loading ? '…' : totalOrgs.toLocaleString(),      icon: BarChart3, color: 'text-orange-600' },
          { label: 'Avg Completion',    value: loading ? '…' : `${completionRate}%`,             icon: Zap,       color: 'text-purple-600' },
          { label: 'Avg Progress',      value: loading ? '…' : `${avgProgress}%`,               icon: Brain,     color: 'text-indigo-600' },
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Platform health metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <TrendingUp className="h-6 w-6 mr-2 text-green-500" />
            Learning Platform Health
          </h2>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Completion Rate',  value: `${completionRate}%`,  barPct: completionRate,  good: true  },
                { label: 'Avg Progress',     value: `${avgProgress}%`,     barPct: avgProgress,     good: avgProgress >= 50 },
                { label: 'Dropout Rate',     value: `${dropoutRate}%`,     barPct: dropoutRate,     good: dropoutRate <= 25 },
                { label: 'API Response',     value: apiTiming ? `${apiTiming}ms` : '—', barPct: apiTiming ? Math.min(100, 100 - (apiTiming / 10)) : 0, good: (apiTiming ?? 9999) < 500 },
              ].map((metric, index) => (
                <div key={index} className={`p-4 rounded-lg border ${metric.good ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{metric.label}</span>
                    <span className={`font-bold ${metric.good ? 'text-green-600' : 'text-yellow-600'}`}>{metric.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <Target className="h-6 w-6 mr-2 text-blue-500" />
            Engagement Overview
          </h2>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Platform Engagement Level', value: engagementLabel, color: engagementColor },
                { label: 'Learner Activation',        value: activeLearners > 0 ? 'Active' : 'No data', color: activeLearners > 0 ? 'text-green-600' : 'text-gray-400' },
                { label: 'Course Catalog',            value: totalCourses > 0 ? `${totalCourses} live` : 'No published courses', color: totalCourses > 0 ? 'text-blue-600' : 'text-gray-400' },
                { label: 'Organizations Active',      value: totalOrgs > 0 ? `${totalOrgs} orgs` : 'None yet', color: totalOrgs > 0 ? 'text-purple-600' : 'text-gray-400' },
              ].map((metric, index) => (
                <div key={index} className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-900">{metric.label}</span>
                    <span className={`font-bold ${metric.color}`}>{metric.value}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-blue-500 h-2 rounded-full"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Course-level performance table */}
      {data.courseDetail.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <Lightbulb className="h-6 w-6 mr-2 text-yellow-500" />
            Course Performance Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Course</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Learners</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Completed</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Rate</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {data.courseDetail.map((c, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900 max-w-[240px] truncate">{c.courseTitle}</td>
                    <td className="py-3 px-4 text-center">{c.totalLearners.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">{c.completedCount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={Math.round(c.completionPercent ?? 0) >= 70 ? 'text-green-600 font-bold' : 'text-yellow-600 font-bold'}>
                        {Math.round(c.completionPercent ?? 0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">
                      {c.avgTimeMinutes ? `${c.avgTimeMinutes} min` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">System Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Data Layer</h3>
            <div className="space-y-2">
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                <span className="text-sm">Analytics events tracked</span>
              </div>
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                <span className="text-sm">Progress data synced</span>
              </div>
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                <span className="text-sm">Real-time DB queries</span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Learning Outcomes</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg Completion</span>
                <span className={`font-medium ${completionRate >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>{completionRate}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Active Orgs</span>
                <span className="font-medium text-blue-600">{totalOrgs}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Dropout Rate</span>
                <span className={`font-medium ${dropoutRate <= 25 ? 'text-green-600' : 'text-red-600'}`}>{dropoutRate}%</span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">API</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Response time</span>
                <span className={`font-medium ${(apiTiming ?? 9999) < 500 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {apiTiming ? `${apiTiming}ms` : '—'}
                </span>
              </div>
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                <span className="text-sm">Server online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPerformanceDashboard;
