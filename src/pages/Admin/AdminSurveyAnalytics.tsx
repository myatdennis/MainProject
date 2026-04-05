import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  Loader2,
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
import { getSurveyById, fetchHdiCohortAnalytics, fetchHdiParticipantReport } from '../../dal/surveys';

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
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>('last-30-days');
  const { data, loading, error, refresh, lastUpdated } = useAnalyticsDashboard({ dateRange });

  const [surveyTitle, setSurveyTitle] = useState<string | null>(null);
  const [surveyType, setSurveyType] = useState<string | null>(null);
  const [surveyNotFound, setSurveyNotFound] = useState(false);
  const [surveyTitleLoading, setSurveyTitleLoading] = useState(false);
  const [hdiLoading, setHdiLoading] = useState(false);
  const [hdiError, setHdiError] = useState<string | null>(null);
  const [hdiParticipants, setHdiParticipants] = useState<any[]>([]);
  const [hdiCohort, setHdiCohort] = useState<any | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    setSurveyTitleLoading(true);
    setSurveyNotFound(false);
    getSurveyById(surveyId)
      .then((survey) => {
        if (!survey) {
          setSurveyNotFound(true);
        } else {
          setSurveyTitle(survey.title || null);
          setSurveyType(String(survey.type ?? (survey.settings as any)?.assessmentType ?? '').toLowerCase());
        }
      })
      .catch(() => setSurveyNotFound(true))
      .finally(() => setSurveyTitleLoading(false));
  }, [surveyId]);

  const isHdiSurvey =
    surveyType === 'hdi' ||
    surveyType === 'hdi-assessment' ||
    surveyType === 'hdi-huddle-development-inventory' ||
    surveyType === 'hdi-intercultural-development-index';

  useEffect(() => {
    if (!surveyId || !isHdiSurvey) {
      setHdiParticipants([]);
      setHdiCohort(null);
      setHdiError(null);
      return;
    }

    let active = true;
    setHdiLoading(true);
    setHdiError(null);

    Promise.all([fetchHdiCohortAnalytics(surveyId), fetchHdiParticipantReport(surveyId, { limit: 500 })])
      .then(([cohort, participants]) => {
        if (!active) return;
        setHdiCohort(cohort);
        setHdiParticipants(Array.isArray(participants) ? participants : []);
      })
      .catch((error) => {
        if (!active) return;
        console.error('[AdminSurveyAnalytics] failed to load HDI analytics', error);
        setHdiError('Unable to load HDI analytics right now.');
      })
      .finally(() => {
        if (active) setHdiLoading(false);
      });

    return () => {
      active = false;
    };
  }, [surveyId, isHdiSurvey]);

  const displayTitle = surveyTitle
    ? surveyTitle
    : surveyId
    ? `Survey ${surveyId.slice(0, 8)}…`
    : 'Survey Analytics';

  const summary = useMemo(() => buildSurveySummary(data), [data]);
  const riskPredictions = useMemo(() => data.predictions.slice(0, 6), [data.predictions]);
  const criticalDropoffs = useMemo(
    () => data.dropoffs.filter((drop) => drop.dropoffPercent >= 35).slice(0, 4),
    [data.dropoffs],
  );
  const prioritySkills = useMemo(() => data.skillGaps.slice(0, 4), [data.skillGaps]);

  // Guard: invalid or missing surveyId
  if (!surveyId) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle className="h-12 w-12 text-orange-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Survey Selected</h2>
          <p className="text-gray-600 mb-6">A valid survey ID is required to view analytics.</p>
          <button
            onClick={() => navigate('/admin/surveys')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Surveys
          </button>
        </div>
      </div>
    );
  }

  // Guard: survey not found
  if (surveyNotFound) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Survey Not Found</h2>
          <p className="text-gray-600 mb-6">
            The survey with ID <code className="font-mono bg-gray-100 px-2 py-0.5 rounded">{surveyId.slice(0, 12)}…</code> could not be found.
          </p>
          <button
            onClick={() => navigate('/admin/surveys')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Surveys
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <div>
        <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Surveys', to: '/admin/surveys' }, { label: 'Analytics' }]} />
      </div>

      {/* Analytics load error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Analytics data failed to load</p>
            <p className="text-sm text-red-600 mt-0.5">{String(error)}</p>
          </div>
          <button onClick={refresh} className="ml-auto text-sm text-red-600 hover:underline font-medium">
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <Link
            to="/admin/surveys"
            className="inline-flex items-center text-[var(--hud-orange)] hover:opacity-80 mb-4 font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Surveys
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            {surveyTitleLoading ? <Loader2 className="h-6 w-6 animate-spin text-gray-400" /> : displayTitle}
          </h1>
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

      {isHdiSurvey && (
        <div className="space-y-6">
          <div className="card-lg space-y-4 border border-rose-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">HDI Cohort Overview</h2>
              {hdiLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
            </div>
            {hdiError ? (
              <p className="text-sm text-red-600">{hdiError}</p>
            ) : hdiCohort ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Average pre</p>
                  <p className="text-xl font-semibold text-gray-900">{hdiCohort.averageOverallPre ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Average post</p>
                  <p className="text-xl font-semibold text-gray-900">{hdiCohort.averageOverallPost ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Delta</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {hdiCohort.averageDelta > 0 ? '+' : ''}
                    {hdiCohort.averageDelta ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Meaningful improvement</p>
                  <p className="text-xl font-semibold text-gray-900">{hdiCohort.meaningfulImprovementPercent ?? 0}%</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No cohort data yet.</p>
            )}
          </div>

          <div className="card-lg space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">HDI Participant Insights</h2>
            {hdiError ? (
              <p className="text-sm text-red-600">{hdiError}</p>
            ) : hdiParticipants.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200">
                      <th className="py-2 pr-3">Participant</th>
                      <th className="py-2 pr-3">Administration</th>
                      <th className="py-2 pr-3">Score</th>
                      <th className="py-2 pr-3">Band</th>
                      <th className="py-2 pr-3">Top strengths</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hdiParticipants.slice(0, 50).map((row, index) => (
                      <tr key={`${row.responseId}-${index}`} className="border-b border-gray-100">
                        <td className="py-2 pr-3 text-gray-700">{row.participantIdentifier}</td>
                        <td className="py-2 pr-3 text-gray-700">{String(row.administrationType || 'single').toUpperCase()}</td>
                        <td className="py-2 pr-3 text-gray-900 font-medium">{row.overallScore}</td>
                        <td className="py-2 pr-3 text-gray-700">{row.scoreBand}</td>
                        <td className="py-2 pr-3 text-gray-600">
                          {(row.topStrengths || []).map((strength: any) => strength.label).join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No participant HDI data available yet.</p>
            )}
          </div>
        </div>
      )}

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