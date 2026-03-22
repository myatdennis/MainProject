import { useState, useMemo } from 'react';
import { useNavTrace } from '../../hooks/useNavTrace';
import { 
  AlertTriangle,
  Clock,
  Target,
  Brain,
  Download,
  Filter,
  Calendar,
  RefreshCw,
  Zap,
  Users,
  TrendingUp,
  BookOpen,
} from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { useToast } from '../../context/ToastContext';
import { useAnalyticsDashboard, type AnalyticsDateRange } from '../../hooks/useAnalyticsDashboard';
import { LoadingSpinner } from '../../components/LoadingComponents';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Convert server heatmap rows {dow, bucket, events} → HeatmapDay[] */
const buildHeatmapRows = (
  raw: Array<{ dow: number; bucket: number; events: number }>,
): { day: string; hours: number[] }[] => {
  const template: Record<string, number[]> = {};
  DAY_LABELS.forEach((d) => { template[d] = Array(12).fill(0); });
  raw.forEach(({ dow, bucket, events }) => {
    const day = DAY_LABELS[dow];
    if (day && bucket >= 0 && bucket < 12) template[day][bucket] = events;
  });
  return DAY_LABELS.map((day) => ({ day, hours: template[day] }));
};

const AdminAnalytics = () => {
  useNavTrace('AdminAnalytics');

  const { showToast } = useToast();
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>('last-30-days');
  const [selectedMetric, setSelectedMetric] = useState('engagement');

  const { data, loading, error, lastUpdated, refresh } = useAnalyticsDashboard({ dateRange });

  const refreshAnalytics = () => {
    refresh();
    showToast('Analytics refreshed.', 'success');
  };

  const exportInsights = () => {
    // Build CSV with overview + per-course detail
    const rows: string[] = [];
    rows.push('# HuddleCo Analytics Export');
    rows.push(`# Date Range: ${dateRange}`);
    rows.push(`# Exported: ${new Date().toISOString()}`);
    rows.push('');

    // Overview section
    rows.push('## Overview');
    rows.push('Metric,Value');
    rows.push(`Active Learners,${data.overview?.totalActiveLearners ?? 0}`);
    rows.push(`Partner Organizations,${data.overview?.totalOrgs ?? 0}`);
    rows.push(`Published Courses,${data.overview?.totalCourses ?? 0}`);
    rows.push(`Avg Completion Rate,${Math.round(data.overview?.platformAvgCompletion ?? 0)}%`);
    rows.push(`Avg Progress,${Math.round(data.overview?.platformAvgProgress ?? 0)}%`);
    rows.push('');

    // Course detail section
    rows.push('## Course Performance');
    rows.push('Course Title,Total Learners,Completed,Completion %,Avg Time (min)');
    data.courseDetail.forEach((c) => {
      const safe = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      rows.push([
        safe(c.courseTitle),
        c.totalLearners ?? 0,
        c.completedCount ?? 0,
        `${Math.round(c.completionPercent ?? 0)}%`,
        c.avgTimeMinutes ?? 0,
      ].join(','));
    });
    rows.push('');

    // Top orgs section
    if (data.topOrgs.length > 0) {
      rows.push('## Top Organizations');
      rows.push('Organization,Total Learners,Completion Rate');
      data.topOrgs.forEach((org) => {
        rows.push([
          `"${String(org.orgName ?? '').replace(/"/g, '""')}"`,
          org.totalLearners ?? 0,
          `${Math.round(org.completionRate ?? 0)}%`,
        ].join(','));
      });
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `huddleco-analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Analytics exported as CSV.', 'success');
  };

  // ── Overview stats ────────────────────────────────────────────────────
  const ov = data.overview;
  const predictiveMetrics = useMemo(() => [
    {
      label: 'Completion Rate',
      value: ov?.platformAvgCompletion != null ? `${Math.round(ov.platformAvgCompletion)}%` : '—',
      color: 'text-green-600',
    },
    {
      label: 'Avg Progress',
      value: ov?.platformAvgProgress != null ? `${Math.round(ov.platformAvgProgress)}%` : '—',
      color: 'text-blue-600',
    },
    {
      label: 'Active Learners',
      value: ov?.totalActiveLearners != null ? ov.totalActiveLearners.toLocaleString() : '—',
      color: 'text-purple-600',
    },
    {
      label: 'Organizations',
      value: ov?.totalOrgs != null ? ov.totalOrgs.toLocaleString() : '—',
      color: 'text-orange-600',
    },
  ], [ov]);

  // ── Heatmap ───────────────────────────────────────────────────────────
  const engagementHeatmap = useMemo(
    () => buildHeatmapRows(data.rawHeatmap),
    [data.rawHeatmap],
  );

  // ── Learner Journey from course detail ───────────────────────────────
  const learnerJourney = useMemo(() => {
    if (data.courseDetail.length === 0) return [];
    // Aggregate across all courses: stages as completion buckets
    const total = data.courseDetail.reduce((s, c) => s + (c.totalLearners ?? 0), 0);
    if (total === 0) return [];
    const completed = data.courseDetail.reduce((s, c) => s + (c.completedCount ?? 0), 0);
    const inProgress = total - completed;
    return [
      { stage: 'Enrolled', users: total, conversion: 100, avgTime: '—' },
      { stage: 'Started', users: inProgress + completed, conversion: total > 0 ? Math.round(((inProgress + completed) / total) * 100) : 0, avgTime: '—' },
      { stage: 'Completed', users: completed, conversion: total > 0 ? Math.round((completed / total) * 100) : 0, avgTime: '—' },
    ];
  }, [data.courseDetail]);

  // ── Content performance from real courseDetail ────────────────────────
  const contentPerformance = useMemo(() =>
    data.courseDetail.map((c) => ({
      content: c.courseTitle,
      views: c.totalLearners,
      completion: Math.round(c.completionPercent ?? 0),
      avgWatchTime: c.avgTimeMinutes ? `${c.avgTimeMinutes} min` : '—',
      engagement: (c.completionPercent ?? 0) >= 75 ? 'High' : (c.completionPercent ?? 0) >= 45 ? 'Medium' : 'Low',
      feedback: null as null,
    })),
    [data.courseDetail],
  );

  const getEngagementColor = (engagement: string) => {
    switch (engagement) {
      case 'High':   return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low':    return 'bg-red-100 text-red-800';
      default:       return 'bg-gray-100 text-gray-800';
    }
  };

  const getHeatmapColor = (value: number) => {
    if (value === 0) return 'bg-gray-100';
    if (value <= 2) return 'bg-blue-100';
    if (value <= 5) return 'bg-blue-200';
    if (value <= 10) return 'bg-blue-300';
    if (value <= 20) return 'bg-blue-400';
    if (value <= 40) return 'bg-blue-500';
    return 'bg-blue-600';
  };

  // ── AI Insights derived from real data ────────────────────────────────
  const aiInsights = useMemo(() => {
    const insights = [];
    // At-risk: courses with < 30% completion
    const atRiskCourses = data.courseDetail.filter((c) => (c.completionPercent ?? 0) < 30 && (c.totalLearners ?? 0) > 0);
    if (atRiskCourses.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Low-Completion Courses Detected',
        description: `${atRiskCourses.length} course${atRiskCourses.length > 1 ? 's' : ''} have fewer than 30% completion — consider adding checkpoints or reminders.`,
        confidence: 90,
        action: 'Review course design',
        icon: AlertTriangle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
      });
    }
    // High-performer: courses with >= 80% completion
    const topCourse = data.courseDetail.find((c) => (c.completionPercent ?? 0) >= 80);
    if (topCourse) {
      insights.push({
        type: 'success',
        title: 'High-Performing Course',
        description: `"${topCourse.courseTitle}" has ${Math.round(topCourse.completionPercent ?? 0)}% completion — replicate its format in other modules.`,
        confidence: 94,
        action: 'Replicate format',
        icon: Target,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      });
    }
    // Peak engagement time from heatmap
    let maxBucket = { dow: -1, bucket: -1, events: 0 };
    data.rawHeatmap.forEach((r) => { if (r.events > maxBucket.events) maxBucket = r; });
    if (maxBucket.events > 0) {
      const dayName = DAY_LABELS[maxBucket.dow];
      const hourStart = maxBucket.bucket * 2;
      const hourEnd = hourStart + 2;
      insights.push({
        type: 'info',
        title: 'Peak Engagement Window',
        description: `Learners are most active on ${dayName}s between ${hourStart}:00–${hourEnd}:00. Schedule live sessions or push notifications then.`,
        confidence: 82,
        action: 'Schedule sessions',
        icon: Clock,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
      });
    }
    // Fallback if no data yet
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        title: 'No Data Yet',
        description: 'Start assigning courses and tracking learner progress to generate AI-powered insights.',
        confidence: 100,
        action: 'Assign courses',
        icon: Brain,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
      });
    }
    return insights;
  }, [data.courseDetail, data.rawHeatmap]);

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Analytics', to: '/admin/analytics' }]} />
      </div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics & Insights</h1>
          <p className="text-gray-600">
            Real-time data from learner progress, course completions, and engagement events.
            {lastUpdated && (
              <span className="ml-2 text-xs text-gray-400">
                Updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        {loading && <LoadingSpinner size="sm" />}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Failed to load analytics</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="card-lg card-hover mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as AnalyticsDateRange)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent"
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
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent"
              >
                <option value="engagement">Engagement Analysis</option>
                <option value="performance">Performance Metrics</option>
                <option value="content">Content Analysis</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={refreshAnalytics} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 font-medium">
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button onClick={exportInsights} className="btn-cta px-4 py-2 rounded-lg flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {predictiveMetrics.map((metric, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                <p className={`text-2xl font-bold mt-1 ${metric.color}`}>{loading ? '…' : metric.value}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-50">
                <Brain className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-6">
          <Brain className="h-6 w-6 text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900">Insights</h2>
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
                      <span className={`text-sm font-medium ${insight.color}`}>{insight.action} →</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Engagement Heatmap */}
        <div className="card-lg">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Engagement Heatmap</h2>
          <p className="text-xs text-gray-500 mb-4">Active events by day × 2-hour bucket</p>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
          ) : engagementHeatmap.every((d) => d.hours.every((v) => v === 0)) ? (
            <p className="text-sm text-gray-500 py-8 text-center">No engagement events recorded yet.</p>
          ) : (
            <>
              <div className="space-y-2">
                <div className="grid grid-cols-13 gap-1 text-xs text-gray-500 mb-2">
                  <div></div>
                  {Array.from({ length: 12 }, (_, i) => (
                    <div key={i} className="text-center">{`${i * 2}h`}</div>
                  ))}
                </div>
                {engagementHeatmap.map((day, dayIndex) => (
                  <div key={dayIndex} className="grid grid-cols-13 gap-1">
                    <div className="text-xs text-gray-500 py-1">{day.day}</div>
                    {day.hours.map((value, hourIndex) => (
                      <div
                        key={hourIndex}
                        className={`h-4 rounded-sm ${getHeatmapColor(value)}`}
                        title={`${day.day} ${hourIndex * 2}:00–${hourIndex * 2 + 2}:00 — ${value} events`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                <span>Less active</span>
                <div className="flex space-x-1">
                  {['bg-gray-100','bg-blue-100','bg-blue-300','bg-blue-500','bg-blue-600'].map((c, i) => (
                    <div key={i} className={`w-3 h-3 ${c} rounded-sm`} />
                  ))}
                </div>
                <span>More active</span>
              </div>
            </>
          )}
        </div>

        {/* Learner Journey */}
        <div className="card-lg">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Learner Journey</h2>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
          ) : learnerJourney.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No learner progress data available yet.</p>
          ) : (
            <div className="space-y-4">
              {learnerJourney.map((stage, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{stage.stage}</div>
                    <div className="text-sm text-gray-600">{stage.users.toLocaleString()} learners</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{stage.conversion}%</div>
                    <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${stage.conversion}%`, background: 'var(--gradient-blue-green)' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Organizations */}
      {data.topOrgs.length > 0 && (
        <div className="card-lg mb-8">
          <div className="flex items-center space-x-2 mb-6">
            <Users className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900">Top Organizations by Learner Activity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Organization</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Learners</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.topOrgs.map((org, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{org.orgName}</td>
                    <td className="py-3 px-4 text-center text-gray-700">{org.totalLearners.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: `${Math.min(100, org.completionRate ?? 0)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{Math.round(org.completionRate ?? 0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Content Performance */}
      <div className="card-lg mb-8">
        <div className="flex items-center space-x-2 mb-6">
          <BookOpen className="h-5 w-5 text-green-500" />
          <h2 className="text-xl font-bold text-gray-900">Course Performance</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
        ) : contentPerformance.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">No published courses with learner data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Course</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Learners</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Completion</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Avg. Time</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {contentPerformance.map((content, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{content.content}</div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="font-medium text-gray-900">{content.views.toLocaleString()}</div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="font-medium text-gray-900">{content.completion}%</div>
                    </td>
                    <td className="py-4 px-4 text-center text-gray-600">{content.avgWatchTime}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEngagementColor(content.engagement)}`}>
                        {content.engagement}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lesson Drop-offs */}
      {data.dropoffs.length > 0 && (
        <div className="card-lg mb-8">
          <div className="flex items-center space-x-2 mb-6">
            <TrendingUp className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-bold text-gray-900">Top Lesson Drop-offs</h2>
          </div>
          <div className="space-y-3">
            {data.dropoffs.slice(0, 10).map((d, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{d.lessonTitle}</p>
                  <p className="text-xs text-gray-500">
                    {d.startedCount} started · {d.completedCount} completed
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-red-600 font-bold text-sm">{Math.round(d.dropoffPercent)}% drop-off</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      <div className="rounded-xl p-8" style={{ background: 'var(--gradient-banner)' }}>
        <div className="flex items-center space-x-3 mb-6">
          <Zap className="h-6 w-6 text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900">AI Recommendations</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Optimize Low-Performing Content</h3>
            <p className="text-sm text-gray-600 mb-3">Break down courses with low completion into smaller, interactive segments to improve engagement.</p>
            <span className="text-sm text-purple-600 font-medium">View suggestions →</span>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Schedule Reminders at Peak Times</h3>
            <p className="text-sm text-gray-600 mb-3">Use the heatmap above to find the optimal window for sending learner nudges and push notifications.</p>
            <span className="text-sm text-purple-600 font-medium">Set up automations →</span>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Replicate Top-Performing Formats</h3>
            <p className="text-sm text-gray-600 mb-3">Use the structure of your highest-completion courses as a template for new content creation.</p>
            <span className="text-sm text-purple-600 font-medium">Open Course Builder →</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;

