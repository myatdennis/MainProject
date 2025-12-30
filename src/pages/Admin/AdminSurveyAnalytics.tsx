import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Share,
  Download,
  Target,
  AlertTriangle,
  CheckCircle,
  Brain,
  Activity,
} from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Skeleton from '../../components/ui/Skeleton';
import {
  useAnalyticsDashboard,
  type AnalyticsDateRange,
  type PredictionInsight,
} from '../../hooks/useAnalyticsDashboard';
import {
  SurveyAnalyticsDashboardView,
  buildSurveySummary,
} from '../../components/Survey/SurveyAnalyticsDashboard';

const RANGE_OPTIONS: { label: string; value: AnalyticsDateRange }[] = [
  { label: '7 days', value: 'last-7-days' },
  { label: '30 days', value: 'last-30-days' },
  { label: '90 days', value: 'last-90-days' },
  { label: '1 year', value: 'last-year' },
];

const riskColor: Record<PredictionInsight['risk'], string> = {
  low: 'text-emerald-600 bg-emerald-50',
  medium: 'text-amber-600 bg-amber-50',
  high: 'text-red-600 bg-red-50',
};

const AdminSurveyAnalytics = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>('last-30-days');
  const { data, loading, error, refresh, lastUpdated } = useAnalyticsDashboard({ dateRange });

  const summary = useMemo(() => buildSurveySummary(data), [data]);
  const riskPredictions = useMemo(() => data.predictions.slice(0, 6), [data.predictions]);
  const criticalDropoffs = useMemo(
    () => data.dropoffs.filter((drop) => drop.dropoffPercent >= 35).slice(0, 4),
    [data.dropoffs],
  );
  const prioritySkills = useMemo(() => data.skillGaps.slice(0, 4), [data.skillGaps]);

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <div>
        <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Surveys', to: '/admin/surveys' }, { label: 'Analytics' }]} />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <Link
            to="/admin/surveys"
            className="inline-flex items-center text-[var(--hud-orange)] hover:opacity-80 mb-4 font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Surveys
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{surveyId ? `Survey ${surveyId}` : 'Survey Analytics'}</h1>
          <p className="text-gray-600 max-w-2xl">
            Monitor real-time response volume, sentiment, and participation trends across every organization. All
            charts below reflect live data from the admin analytics API and auto-refresh when learners submit updates.
          </p>
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-2">Last updated {new Date(lastUpdated).toLocaleString()}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={refresh} className="btn-outline flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
          <button className="btn-outline flex items-center space-x-2">
            <Share className="h-4 w-4" />
            <span>Share</span>
          </button>
          <button className="btn-cta flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="card-lg card-hover">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <p className="text-sm text-gray-600">
              Showing activity for the past&nbsp;
              <strong>{RANGE_OPTIONS.find((option) => option.value === dateRange)?.label}</strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value as AnalyticsDateRange)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)]"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={refresh}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sync now</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-lg">
          <p className="text-sm text-gray-500">Total responses</p>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? <Skeleton className="h-8 w-20" /> : summary.totalResponses.toLocaleString()}
          </p>
        </div>
        <div className="card-lg">
          <p className="text-sm text-gray-500">Avg. Sentiment Rating</p>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? <Skeleton className="h-8 w-24" /> : summary.avgRating ? `${summary.avgRating}/5` : '—'}
          </p>
        </div>
        <div className="card-lg">
          <p className="text-sm text-gray-500">Participating orgs</p>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? <Skeleton className="h-8 w-20" /> : summary.uniqueOrgs}
          </p>
        </div>
        <div className="card-lg">
          <p className="text-sm text-gray-500">Courses with activity</p>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? <Skeleton className="h-8 w-20" /> : summary.courseCoverage}
          </p>
        </div>
      </div>

      <SurveyAnalyticsDashboardView
        surveyId={surveyId}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        loading={loading}
        error={error}
        data={data}
        onRefresh={refresh}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900">At-risk cohorts</h2>
            </div>
            <span className="text-sm text-gray-500">Top {riskPredictions.length}</span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : riskPredictions.length ? (
            <div className="space-y-3">
              {riskPredictions.map((prediction) => (
                <div
                  key={prediction.user}
                  className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">User {prediction.user.slice(0, 6)}</p>
                    <p className="text-xs text-gray-500">Engagement {prediction.engagementScore}% • Progress {prediction.progress}%</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${riskColor[prediction.risk]}`}>
                      {prediction.risk.toUpperCase()} RISK
                    </span>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{prediction.likelihood}% to complete</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No prediction data available for this range.</p>
          )}
        </div>

        <div className="card-lg space-y-4">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-sky-500" />
            <h2 className="text-lg font-semibold text-gray-900">Skill gap radar</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : prioritySkills.length ? (
            <div className="space-y-3">
              {prioritySkills.map((skill) => (
                <div key={skill.skill} className="p-3 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{skill.skill}</p>
                    <span className="text-sm text-gray-500">Target {skill.target}%</span>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Current {skill.current}%</span>
                      <span>Gap {skill.gap}%</span>
                    </div>
                    <div className="mt-1 h-2 bg-gray-200 rounded-full">
                      <div
                        className="h-2 rounded-full bg-[var(--hud-orange)]"
                        style={{ width: `${Math.min(100, skill.current)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No skill gap insights available.</p>
          )}
        </div>
      </div>

      <div className="card-lg space-y-4">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-gray-900">Recommended follow-ups</h2>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {criticalDropoffs.length ? (
              criticalDropoffs.map((drop) => (
                <li key={`${drop.courseId}-${drop.lessonId}`} className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {drop.lessonTitle} · {drop.courseId.slice(0, 8)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {drop.dropoffPercent}% learners drop between {drop.startedCount} starts and {drop.completedCount} completions.
                      Prioritize coaching materials or supplemental nudges.
                    </p>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-sm text-gray-500">Drop-off rates look healthy across the selected range.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminSurveyAnalytics;