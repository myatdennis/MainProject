import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { TrendingUp, Users, BarChart3, AlertTriangle, RefreshCw, Building2, Target } from 'lucide-react';
import Skeleton from '../ui/Skeleton';
import {
  useAnalyticsDashboard,
  type AnalyticsDateRange,
  type AnalyticsDashboardData,
} from '../../hooks/useAnalyticsDashboard';

const RANGE_OPTIONS: { label: string; value: AnalyticsDateRange }[] = [
  { label: '7 days', value: 'last-7-days' },
  { label: '30 days', value: 'last-30-days' },
  { label: '90 days', value: 'last-90-days' },
  { label: '1 year', value: 'last-year' },
];

const COLOR_PALETTE = ['#3A7DFF', '#228B22', '#de7b12', '#D72638', '#1E1E22', '#F6C87B'];

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value)}%`;
};

const LoadingState = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  </div>
);

const EmptyState = ({ onRefresh }: { onRefresh: () => void }) => (
  <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
    <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
    <h3 className="text-xl font-semibold text-gray-900 mb-2">No survey activity yet</h3>
    <p className="text-gray-500 mb-6">
      We could not find survey responses within the selected date range. Try expanding the range or collect
      new responses to see analytics here.
    </p>
    <button
      onClick={onRefresh}
      className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-[var(--hud-orange)] text-white shadow-sm"
    >
      <RefreshCw className="w-4 h-4" />
      <span>Refresh data</span>
    </button>
  </div>
);

export interface SurveySummary {
  totalResponses: number;
  avgRating: number | null;
  uniqueOrgs: number;
  courseCoverage: number;
  organizations: Array<{
    organizationId: string;
    label: string;
    responses: number;
    avgRating: number | null;
    courseCount: number;
  }>;
}

export const buildSurveySummary = (data: AnalyticsDashboardData): SurveySummary => {
  const orgMap = new Map<
    string,
    { responses: number; ratingSum: number; ratingCount: number; courses: Set<string> }
  >();
  const courseSet = new Set<string>();
  let responsesTotal = 0;
  let ratingWeightedSum = 0;
  let ratingWeightedCount = 0;

  data.surveySummary.forEach((entry) => {
    const key = entry.organizationId ?? 'unattributed';
    const existing =
      orgMap.get(key) ?? { responses: 0, ratingSum: 0, ratingCount: 0, courses: new Set<string>() };
    existing.responses += entry.responses;
    if (typeof entry.avgRating === 'number') {
      existing.ratingSum += entry.avgRating * entry.responses;
      existing.ratingCount += entry.responses;
      ratingWeightedSum += entry.avgRating * entry.responses;
      ratingWeightedCount += entry.responses;
    }
    existing.courses.add(entry.courseId);
    orgMap.set(key, existing);
    responsesTotal += entry.responses;
    courseSet.add(entry.courseId);
  });

  const organizations = Array.from(orgMap.entries())
    .map(([organizationId, stats]) => ({
      organizationId,
      label: organizationId === 'unattributed' ? 'Unattributed' : organizationId,
      responses: stats.responses,
      avgRating: stats.ratingCount ? +(stats.ratingSum / stats.ratingCount).toFixed(2) : null,
      courseCount: stats.courses.size,
    }))
    .sort((a, b) => b.responses - a.responses);

  return {
    totalResponses: responsesTotal,
    avgRating: ratingWeightedCount ? +(ratingWeightedSum / ratingWeightedCount).toFixed(2) : null,
    uniqueOrgs: organizations.length,
    courseCoverage: courseSet.size,
    organizations,
  };
};

interface InsightCard {
  id: string;
  title: string;
  detail: string;
  tone: 'positive' | 'neutral' | 'warning';
}

export interface SurveyAnalyticsDashboardViewProps {
  surveyId?: string;
  dateRange: AnalyticsDateRange;
  onDateRangeChange?: (value: AnalyticsDateRange) => void;
  loading: boolean;
  error: Error | null;
  data: AnalyticsDashboardData;
  onRefresh: () => void;
}

export const SurveyAnalyticsDashboardView: React.FC<SurveyAnalyticsDashboardViewProps> = ({
  surveyId,
  dateRange,
  onDateRangeChange,
  loading,
  error,
  data,
  onRefresh,
}) => {
  const summary = useMemo(() => buildSurveySummary(data), [data]);

  const trendData = useMemo(
    () =>
      data.engagementTrend.map((point) => ({
        date: point.date,
        engagement: point.engagement,
        completion: point.completion,
      })),
    [data.engagementTrend],
  );

  const hourlyData = useMemo(
    () =>
      data.hourlyUsage.map((entry) => ({
        hour: `${entry.hour}:00`,
        responses: entry.usage,
        engagement: entry.engagement,
      })),
    [data.hourlyUsage],
  );

  const insights = useMemo<InsightCard[]>(() => {
    const cards: InsightCard[] = [];
    const topOrg = summary.organizations[0];
    if (summary.avgRating && summary.avgRating >= 4) {
      cards.push({
        id: 'rating-strength',
        title: 'High satisfaction signal',
        detail: `Average sentiment rating ${summary.avgRating}/5 across ${summary.totalResponses.toLocaleString()} responses.`,
        tone: 'positive',
      });
    }
    if (topOrg) {
      cards.push({
        id: 'top-organization',
        title: `${topOrg.label}`,
        detail: `${topOrg.responses.toLocaleString()} responses • ${topOrg.courseCount} courses reporting`,
        tone: 'neutral',
      });
    }
    const hotspot = data.dropoffs[0];
    if (hotspot && hotspot.dropoffPercent > 40) {
      cards.push({
        id: 'dropoff-risk',
        title: 'Drop-off hotspot detected',
        detail: `${hotspot.lessonTitle} is losing ${formatPercent(hotspot.dropoffPercent)} of learners. Review supporting materials.`,
        tone: 'warning',
      });
    }
    if (!cards.length) {
      cards.push({
        id: 'no-signal',
        title: 'Collect more responses',
        detail: 'We need a few more submissions to unlock richer insights.',
        tone: 'neutral',
      });
    }
    return cards;
  }, [summary, data.dropoffs]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-2xl p-6 flex items-start space-x-4">
        <AlertTriangle className="w-6 h-6 text-red-500" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Unable to load survey analytics</h3>
          <p className="text-sm text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={onRefresh}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-[var(--hud-orange)] text-white"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (!summary.totalResponses) {
    return <EmptyState onRefresh={onRefresh} />;
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--hud-orange)] uppercase tracking-wide">Survey Analytics</p>
          <h2 className="text-2xl font-bold text-gray-900">{surveyId ? `Survey ${surveyId}` : 'Survey Overview'}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          <select
            value={dateRange}
            onChange={(event) => onDateRangeChange?.(event.target.value as AnalyticsDateRange)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)]"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={onRefresh}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <Users className="w-10 h-10 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500">Total Responses</p>
              <p className="text-3xl font-bold text-gray-900">
                {summary.totalResponses.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-10 h-10 text-purple-600" />
            <div>
              <p className="text-sm text-gray-500">Avg. Sentiment Rating</p>
              <p className="text-3xl font-bold text-gray-900">
                {summary.avgRating ? `${summary.avgRating}/5` : '—'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <Building2 className="w-10 h-10 text-emerald-600" />
            <div>
              <p className="text-sm text-gray-500">Participating Orgs</p>
              <p className="text-3xl font-bold text-gray-900">{summary.uniqueOrgs}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-10 h-10 text-orange-500" />
            <div>
              <p className="text-sm text-gray-500">Course Coverage</p>
              <p className="text-3xl font-bold text-gray-900">{summary.courseCoverage}</p>
            </div>
          </div>
        </div>
      </div>

      {summary.organizations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Responses by Organization</h3>
            <span className="text-sm text-gray-500">Top {Math.min(summary.organizations.length, 8)}</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.organizations.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" angle={-30} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number) => `${value} responses`} />
                <Bar dataKey="responses" fill="#3A7DFF" name="Responses" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Engagement Timeline</h3>
            <span className="text-sm text-gray-500">Scaled scores</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="engagement" stroke="#3A7DFF" strokeWidth={2} name="Engagement" />
                <Line type="monotone" dataKey="completion" stroke="#228B22" strokeWidth={2} name="Completion" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Peak Activity Hours</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" interval={2} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="responses" fill="#de7b12" name="Responses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Performance Snapshot</h3>
          <div className="space-y-4">
            {data.courses.slice(0, 5).map((course, index) => (
              <div key={course.courseId} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ backgroundColor: COLOR_PALETTE[index % COLOR_PALETTE.length] }}
                  >
                    {course.courseId.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Course {course.courseId.slice(0, 6)}</p>
                    <p className="text-xs text-gray-500">{course.totalUsers} learners</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatPercent(course.completionPercent)}</p>
                  <p className="text-xs text-gray-500">Completion</p>
                </div>
              </div>
            ))}
            {!data.courses.length && <p className="text-sm text-gray-500">No course analytics available.</p>}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Target className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI-style Insights</h3>
          </div>
          <div className="space-y-4">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`rounded-xl border p-4 ${
                  insight.tone === 'positive'
                    ? 'border-emerald-200 bg-emerald-50'
                    : insight.tone === 'warning'
                      ? 'border-orange-200 bg-orange-50'
                      : 'border-gray-200 bg-gray-50'
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">{insight.title}</p>
                <p className="text-sm text-gray-700 mt-1">{insight.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Drop-off Hotspots</h3>
          <span className="text-sm text-gray-500">Top 5 lessons</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lesson</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Drop-off</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.dropoffs.slice(0, 5).map((drop) => (
                <tr key={`${drop.courseId}-${drop.lessonId}`}>
                  <td className="px-4 py-3 text-sm text-gray-900">{drop.courseId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{drop.lessonTitle}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-orange-600">
                    {formatPercent(drop.dropoffPercent)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{drop.startedCount}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{drop.completedCount}</td>
                </tr>
              ))}
              {!data.dropoffs.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                    No drop-off data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

interface SurveyAnalyticsDashboardProps {
  surveyId?: string;
  initialDateRange?: AnalyticsDateRange;
}

const SurveyAnalyticsDashboard: React.FC<SurveyAnalyticsDashboardProps> = ({ surveyId, initialDateRange }) => {
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>(initialDateRange ?? 'last-30-days');
  const { data, loading, error, refresh } = useAnalyticsDashboard({ dateRange });

  return (
    <SurveyAnalyticsDashboardView
      surveyId={surveyId}
      data={data}
      loading={loading}
      error={error}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      onRefresh={refresh}
    />
  );
};

export default SurveyAnalyticsDashboard;