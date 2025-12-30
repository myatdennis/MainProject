import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { RefreshCw, AlertTriangle, Brain, Target, Users, Clock, TrendingUp, Zap } from 'lucide-react';
import Skeleton from '../ui/Skeleton';
import { useAnalyticsDashboard, type AnalyticsDateRange } from '../../hooks/useAnalyticsDashboard';

const DATE_RANGE_OPTIONS: { label: string; value: AnalyticsDateRange }[] = [
  { label: 'Last 7 days', value: 'last-7-days' },
  { label: 'Last 30 days', value: 'last-30-days' },
  { label: 'Last 90 days', value: 'last-90-days' },
  { label: 'Last year', value: 'last-year' },
];

const HEATMAP_LABELS = ['12a', '2a', '4a', '6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p'];

const getRiskTone = (risk: 'low' | 'medium' | 'high') => {
  switch (risk) {
    case 'low':
      return 'bg-emerald-50 text-emerald-700';
    case 'medium':
      return 'bg-amber-50 text-amber-700';
    case 'high':
    default:
      return 'bg-rose-50 text-rose-700';
  }
};

const HeatmapLegend = () => (
  <div className="flex items-center justify-between text-xs text-slate/70 mt-3">
    <span>Less active</span>
    <div className="flex space-x-1">
      <span className="w-3 h-3 rounded bg-slate-100" />
      <span className="w-3 h-3 rounded bg-blue-100" />
      <span className="w-3 h-3 rounded bg-blue-300" />
      <span className="w-3 h-3 rounded bg-blue-500" />
      <span className="w-3 h-3 rounded bg-blue-700" />
    </div>
    <span>Most active</span>
  </div>
);

const Heatmap = ({
  data,
}: {
  data: ReturnType<typeof useAnalyticsDashboard>['data']['heatmap'];
}) => (
  <div className="space-y-2">
    <div className="grid grid-cols-13 gap-1 text-xs text-slate/70">
      <div />
      {HEATMAP_LABELS.map((label) => (
        <div key={label} className="text-center">
          {label}
        </div>
      ))}
    </div>
    {data.map((day) => (
      <div key={day.day} className="grid grid-cols-13 gap-1 items-center">
        <div className="text-xs text-slate/70">{day.day}</div>
        {day.hours.map((value, index) => {
          const intensity = Math.min(value, 4);
          const color =
            intensity === 0
              ? 'bg-slate-100'
              : intensity === 1
              ? 'bg-blue-100'
              : intensity === 2
              ? 'bg-blue-300'
              : intensity === 3
              ? 'bg-blue-500'
              : 'bg-blue-700';
          return <div key={index} className={`h-4 rounded ${color}`} title={`${value} sessions`} />;
        })}
      </div>
    ))}
    <HeatmapLegend />
  </div>
);

const LoadingState = () => (
  <div className="space-y-6">
    <Skeleton className="h-32 w-full rounded-xl" />
    <div className="grid gap-4 md:grid-cols-2">
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
    <Skeleton className="h-80 rounded-xl" />
  </div>
);

const EmptyState = () => (
  <div className="text-center py-16 border border-dashed rounded-xl">
    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate/70 mb-4">
      <Brain className="h-6 w-6" />
    </div>
    <h3 className="text-lg font-semibold text-charcoal mb-1">No analytics yet</h3>
    <p className="text-sm text-slate/70 max-w-lg mx-auto">
      We’ll start surfacing AI-powered insights as soon as learners interact with your courses. Try assigning a course or
      encouraging learners to resume progress.
    </p>
  </div>
);

const formatPercent = (value?: number | null, precision = 0) =>
  typeof value === 'number' && !Number.isNaN(value) ? `${value.toFixed(precision)}%` : '—';

const LearningAnalyticsEngine: React.FC = () => {
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>('last-30-days');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const { data, loading, error, refresh } = useAnalyticsDashboard({
    dateRange,
    courseId: courseFilter === 'all' ? undefined : courseFilter,
  });

  const hasData = useMemo(() => {
    return (
      data.engagementTrend.length > 0 ||
      data.heatmap.length > 0 ||
      data.predictions.length > 0 ||
      data.dropoffs.length > 0 ||
      Boolean(data.courseAnalytics)
    );
  }, [data]);

  const selectedCourse = useMemo(() => {
    if (courseFilter === 'all') return undefined;
    return data.courses.find((entry) => entry.courseId === courseFilter);
  }, [courseFilter, data.courses]);

  const aiInsights = useMemo(() => {
    const insights = [] as Array<{
      icon: React.ComponentType<any>;
      tone: string;
      title: string;
      description: string;
      action: string;
    }>;

    const courseStats = data.courseAnalytics;
    if (courseStats) {
      const completionChange = selectedCourse?.completionPercent ?? courseStats.completionRate;
      insights.push({
        icon: TrendingUp,
        tone: 'text-emerald-600',
        title: 'Completion momentum detected',
        description: `Completion is holding at ${completionChange.toFixed(1)}%. Encourage learners to finish within this window.`,
        action: 'Nudge learners',
      });
      if (courseStats.dropOffRate > 30) {
        insights.push({
          icon: AlertTriangle,
          tone: 'text-rose-600',
          title: 'High drop-off pattern',
          description: 'Drop-offs concentrate in the middle of the journey. Consider trimming lessons or adding live touchpoints.',
          action: 'Review lessons',
        });
      }
    }

    if (data.strugglingLearners.length > 0) {
      insights.push({
        icon: Users,
        tone: 'text-amber-600',
        title: `${data.strugglingLearners.length} learners need attention`,
        description: 'These learners show multiple risk signals (quiz failures, inactivity, or low engagement).',
        action: 'Open learner list',
      });
    }

    if (insights.length === 0) {
      insights.push({
        icon: Brain,
        tone: 'text-slate/70',
        title: 'AI is watching for patterns',
        description: 'We’ll suggest interventions as soon as enough signals come in.',
        action: 'Check later',
      });
    }

    return insights.slice(0, 3);
  }, [data.courseAnalytics, data.strugglingLearners, selectedCourse]);

  const courseOptions = useMemo(() => {
    const options = data.courses.map((course) => ({
      label: course.courseId,
      value: course.courseId,
    }));
    return [{ label: 'All courses', value: 'all' }, ...options];
  }, [data.courses]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-charcoal">Learning Analytics Engine</h2>
          <p className="text-sm text-slate/70">Live learner signals, AI predictions, and course performance diagnostics.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.target.value)}
            className="border border-mist rounded-lg px-3 py-2 text-sm"
          >
            {courseOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value as AnalyticsDateRange)}
            className="border border-mist rounded-lg px-3 py-2 text-sm"
          >
            {DATE_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => refresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-mist px-3 py-2 text-sm font-medium text-charcoal hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Unable to load analytics right now. {error.message}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : !hasData ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-mist bg-softwhite p-4">
              <div className="flex items-center justify-between text-sm text-slate/70">
                <span>Engagement score</span>
                <Brain className="h-4 w-4 text-slate/60" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-charcoal">
                {formatPercent(data.courseAnalytics?.engagementScore)}
              </div>
              <p className="text-xs text-slate/60">Weighted mix of activity and depth</p>
            </div>
            <div className="rounded-xl border border-mist bg-softwhite p-4">
              <div className="flex items-center justify-between text-sm text-slate/70">
                <span>Completion rate</span>
                <Target className="h-4 w-4 text-slate/60" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-charcoal">
                {formatPercent(data.courseAnalytics?.completionRate)}
              </div>
              <p className="text-xs text-slate/60">Across assigned learners</p>
            </div>
            <div className="rounded-xl border border-mist bg-softwhite p-4">
              <div className="flex items-center justify-between text-sm text-slate/70">
                <span>Active last 7 days</span>
                <Users className="h-4 w-4 text-slate/60" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-charcoal">
                {data.courseAnalytics?.activeLastWeek ?? '—'}
              </div>
              <p className="text-xs text-slate/60">Unique learners</p>
            </div>
            <div className="rounded-xl border border-mist bg-softwhite p-4">
              <div className="flex items-center justify-between text-sm text-slate/70">
                <span>Avg session length</span>
                <Clock className="h-4 w-4 text-slate/60" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-charcoal">
                {data.courseAnalytics?.averageTimeSpent
                  ? `${Math.round(data.courseAnalytics.averageTimeSpent / 60)} min`
                  : '—'}
              </div>
              <p className="text-xs text-slate/60">Across tracked lessons</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-charcoal">AI-powered insights</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {aiInsights.map((insight, index) => {
                const Icon = insight.icon;
                return (
                  <div key={`${insight.title}-${index}`} className="rounded-xl border border-mist bg-white p-4 shadow-sm">
                    <div className={`flex items-center gap-2 text-sm font-medium ${insight.tone}`}>
                      <Icon className="h-4 w-4" />
                      {insight.title}
                    </div>
                    <p className="mt-2 text-sm text-slate/70">{insight.description}</p>
                    <button className="mt-3 text-sm font-medium text-skyblue hover:underline">{insight.action}</button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-mist bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-charcoal">Engagement vs completion</h3>
                <span className="text-xs text-slate/60">Normalized to 100%</span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.engagementTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="engagement" stroke="#3A7DFF" strokeWidth={2} name="Engagement" />
                    <Line type="monotone" dataKey="completion" stroke="#228B22" strokeWidth={2} name="Completions" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-mist bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-charcoal mb-4">Peak usage by hour</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.hourlyUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="usage" fill="#3A7DFF" name="Sessions" />
                    <Bar dataKey="engagement" fill="#228B22" name="Engaged actions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-mist bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-charcoal mb-4">Engagement heatmap</h3>
              <Heatmap data={data.heatmap} />
            </div>
            <div className="rounded-xl border border-mist bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-charcoal mb-4">Top drop-off locations</h3>
              {data.dropoffs.length === 0 ? (
                <p className="text-sm text-slate/70">No drop-off data yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.dropoffs.slice(0, 5).map((dropoff) => (
                    <div key={`${dropoff.courseId}-${dropoff.lessonId}`} className="rounded-lg border border-mist p-3">
                      <div className="flex justify-between text-sm text-charcoal">
                        <span>{dropoff.lessonTitle}</span>
                        <span className="font-medium text-rose-600">{dropoff.dropoffPercent.toFixed(1)}%</span>
                      </div>
                      <p className="text-xs text-slate/60">
                        {dropoff.completedCount}/{dropoff.startedCount} completed • Course {dropoff.courseId.slice(0, 6)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-mist bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-purple-500" />
                <h3 className="text-lg font-semibold text-charcoal">Learning path performance</h3>
              </div>
              {data.learningPaths.length === 0 ? (
                <p className="text-sm text-slate/70">Not enough course assignments to evaluate learning paths.</p>
              ) : (
                <div className="space-y-3">
                  {data.learningPaths.map((path) => (
                    <div key={path.courseId} className="rounded-lg border border-mist p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-charcoal">{path.path}</p>
                          <p className="text-xs text-slate/60">Avg time {path.avgTime} mins • Satisfaction {path.satisfaction}/5</p>
                        </div>
                        <span className="text-sm font-medium text-skyblue">{path.success}% success</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-mist bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-semibold text-charcoal">Struggling learners</h3>
              </div>
              {data.strugglingLearners.length === 0 ? (
                <p className="text-sm text-slate/70">No risk alerts at the moment.</p>
              ) : (
                <div className="space-y-3">
                  {data.strugglingLearners.slice(0, 4).map((learner) => (
                    <div key={learner.userId} className="rounded-lg border border-mist p-4">
                      <div className="flex items-center justify-between text-sm text-charcoal">
                        <span>{learner.userName}</span>
                        <span>{formatPercent(learner.currentProgress)}</span>
                      </div>
                      <p className="text-xs text-slate/60">Last active {new Date(learner.lastActive).toLocaleDateString()}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {learner.strugglingIndicators.map((indicator) => (
                          <span key={indicator} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                            {indicator.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-mist bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-skyblue" />
              <h3 className="text-lg font-semibold text-charcoal">Completion predictions</h3>
            </div>
            {data.predictions.length === 0 ? (
              <p className="text-sm text-slate/70">AI predictions will appear once we have at least 20 learner journeys.</p>
            ) : (
              <div className="space-y-3">
                {data.predictions.map((prediction) => (
                  <div key={prediction.user} className="flex items-center justify-between rounded-lg border border-mist p-4">
                    <div>
                      <p className="text-sm font-semibold text-charcoal">{prediction.user}</p>
                      <p className="text-xs text-slate/60">Progress {formatPercent(prediction.progress)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-charcoal">{formatPercent(prediction.likelihood)}</p>
                        <p className="text-[11px] text-slate/60">Completion likelihood</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${getRiskTone(prediction.risk)}`}>
                        {prediction.risk} risk
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default LearningAnalyticsEngine;
