import React, { useEffect, useState, lazy, Suspense } from 'react'
import { Users, TrendingUp, Activity as ActivityIcon, Clock, BarChart3, BookOpen, X } from 'lucide-react'
import { getSupabase } from '../../lib/supabaseClient'
import { useToast } from '../../context/ToastContext'
import apiRequest, { ApiError } from '../../utils/apiClient'
import { hasAuthSession } from '../../lib/sessionGate'
const CompletionChart = lazy(() => import('../../components/Analytics/CompletionChart'));

type Overview = {
  total_active_learners?: number
  total_orgs?: number
  total_courses?: number
  platform_avg_progress?: number
  platform_avg_completion?: number
}

type ActivityItem = {
  id: string
  title: string
  detail: string
  timestamp: string
  type: 'progress' | 'completion' | 'login'
}

const toActivityFeed = (activityPayload: any, fallbackCourses: any[]): ActivityItem[] => {
  if (Array.isArray(activityPayload) && activityPayload.length > 0) {
    return activityPayload.slice(0, 10).map((event: any, idx: number) => ({
      id: event.id || `activity-${idx}`,
      title: event.title || event.action || 'Learner activity',
      detail: event.detail || event.course_id || 'Course update',
      timestamp: event.timestamp || new Date().toISOString(),
      type: event.type || 'progress'
    }))
  }

  return fallbackCourses.slice(0, 5).map((course, idx) => ({
    id: `course-${course.course_id}-${idx}`,
    title: `${course.course_id} milestone`,
    detail: `${Math.round(course.completion_percent ?? 0)}% completion • ${Math.round(course.avg_progress ?? 0)}% avg progress`,
    timestamp: new Date(Date.now() - idx * 60000).toISOString(),
    type: 'completion'
  }))
}

const formatNumber = (value?: number) => {
  if (value === undefined || value === null) return '—'
  return value.toLocaleString()
}

const formatPercent = (value?: number) => {
  if (value === undefined || value === null) return '—'
  return `${Math.round(value)}%`
}

const AnalyticsDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [overview, setOverview] = useState<Overview>({})
  const [courses, setCourses] = useState<any[]>([])
  const [dropoffs, setDropoffs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [summaryPreview, setSummaryPreview] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const fetchData = async () => {
    if (!hasAuthSession()) {
      setOverview({})
      setCourses([])
      setDropoffs([])
      setActivityFeed([])
      setLastUpdated(null)
      return
    }

    setLoading(true)
    try {
      const json = await apiRequest<any>('/api/admin/analytics', { noTransform: true })
      const nextCourses = Array.isArray(json?.courses) ? json.courses : []
      setOverview(json?.overview || {})
      setCourses(nextCourses)
      setDropoffs(Array.isArray(json?.dropoffs) ? json.dropoffs : [])
      setActivityFeed(toActivityFeed(json?.activity, nextCourses))
      setLastUpdated(new Date())
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        console.info('[AnalyticsDashboard] Skipping analytics fetch while logged out')
      } else {
        console.error('Failed to load analytics', err)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    // If Supabase client is available, use realtime subscriptions for fresh updates
    let subscription: any = null
    const initRealtime = async () => {
      const supabase = await getSupabase();
      if (!supabase) return;
      try {
        subscription = supabase
          .channel('public:analytics')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'user_course_progress' }, () => {
            fetchData();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'user_lesson_progress' }, () => {
            fetchData();
          })
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription failed, falling back to polling', err);
      }
    };
    initRealtime();

    // Fallback polling every 3s if realtime not available
    const id = setInterval(async () => {
      const supabase = await getSupabase();
      if (!supabase) fetchData();
    }, 3000);

    return () => {
      clearInterval(id);
      try {
        if (subscription && subscription.unsubscribe) subscription.unsubscribe();
      } catch (e) {
        // ignore unsubscribe errors
      }
    };
  }, [])

  const exportCsv = async () => {
    if (!hasAuthSession()) {
      showToast('Please sign in to export analytics.', 'warning')
      return
    }
    try {
      const response = await apiRequest<Response>('/api/admin/analytics/export', {
        method: 'GET',
        rawResponse: true,
      })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'analytics.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Analytics export failed', error)
      showToast('Unable to export analytics. Please try again.', 'error')
    }
  }

  const requestSummary = async () => {
    if (!hasAuthSession()) {
      showToast('Sign in to request an AI summary.', 'warning')
      return
    }
    try {
      setSummaryError(null)
      setSummaryPreview(null)
      const json = await apiRequest<any>('/api/admin/analytics/summary', {
        method: 'POST',
        body: {},
        noTransform: true,
      })
      const preview = JSON.stringify(json?.sample || json?.ai || json?.prompt, null, 2)
      setSummaryPreview(preview)
      showToast('AI summary generated successfully.', 'success')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSummaryError('Session expired. Please sign in and try again.')
        showToast('Session required for AI summary.', 'warning')
      } else {
        console.error('Summary request failed', err)
        setSummaryError('We could not generate a summary right now. Please try again in a moment.')
        showToast('AI summary failed', 'error')
      }
    }
  }

  const metrics = [
    { label: 'Active learners', value: formatNumber(overview.total_active_learners), helper: 'Live seats', icon: Users },
    { label: 'Organizations', value: formatNumber(overview.total_orgs), helper: 'Connected accounts', icon: BarChart3 },
    { label: 'Published courses', value: formatNumber(overview.total_courses), helper: 'Catalog', icon: BookOpen },
    { label: 'Avg completion', value: formatPercent(overview.platform_avg_completion), helper: `Avg progress ${formatPercent(overview.platform_avg_progress)}`, icon: TrendingUp }
  ]

  const lastUpdatedLabel = lastUpdated
    ? `Live • updated ${lastUpdated.toLocaleTimeString()}`
    : 'Waiting for realtime sync'

  const chartData = courses.map((course) => ({ label: course.course_id, value: Number(course.completion_percent ?? 0) }))

  return (
    <div className="space-y-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Live analytics</p>
          <h2 className="mt-1 text-2xl font-semibold text-gray-900">Admin Analytics</h2>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            {lastUpdatedLabel}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={requestSummary}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
          >
            AI Summary
          </button>
        </div>
      </header>

      {summaryPreview && (
        <div className="rounded-3xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold">AI summary preview</p>
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-orange-900">{summaryPreview}</pre>
            </div>
            <button
              aria-label="Dismiss AI summary"
              className="rounded-full p-1 text-orange-700 hover:bg-orange-100"
              onClick={() => setSummaryPreview(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {summaryError && (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
          {summaryError}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, helper, icon: Icon }) => (
          <article key={label} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
                {helper && <p className="text-xs text-gray-400">{helper}</p>}
              </div>
              <div className="rounded-2xl bg-orange-50 p-3 text-orange-500">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Completion trends</h3>
                <p className="text-sm text-gray-500">Top courses ranked by completion rate</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                <ActivityIcon className="h-4 w-4" /> Realtime
              </span>
            </div>
            <div className="mt-6">
              <Suspense fallback={<div className="text-sm text-gray-500">Loading chart…</div>}>
                <CompletionChart data={chartData} />
              </Suspense>
            </div>
            <div className="mt-6 divide-y divide-gray-100">
              {(loading ? Array.from({ length: 3 }) : courses.slice(0, 5)).map((course, idx) => {
                if (loading) {
                  return (
                    <div key={`skeleton-${idx}`} className="flex items-center justify-between py-3 animate-pulse">
                      <div className="h-4 w-40 rounded bg-gray-100" />
                      <div className="h-4 w-16 rounded bg-gray-100" />
                    </div>
                  )
                }
                const completion = formatPercent(course?.completion_percent)
                const avg = formatPercent(course?.avg_progress)
                const completionValue = Number(course?.completion_percent ?? 0)
                const progressWidth = Math.min(100, Number.isNaN(completionValue) ? 0 : completionValue)
                return (
                  <div key={course.course_id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{course.course_id}</p>
                      <p className="text-xs text-gray-500">Avg progress {avg}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold text-gray-900">{completion}</span>
                      <div className="mt-2 h-2 w-32 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-600" style={{ width: `${progressWidth}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Drop-off hotspots</h3>
            <p className="text-sm text-gray-500">Lessons with the highest exit rate</p>
            <div className="mt-4 space-y-4">
              {dropoffs.slice(0, 6).map((drop) => {
                const percentValue = Number(drop?.dropoff_percent ?? 0)
                const percent = Math.min(100, Number.isNaN(percentValue) ? 0 : percentValue)
                return (
                  <div key={`${drop.course_id}_${drop.lesson_id}`}>
                    <div className="flex items-center justify-between text-sm text-gray-700">
                      <span>{drop.course_id} / {drop.lesson_id}</span>
                      <span className="font-semibold text-orange-600">{formatPercent(drop.dropoff_percent)}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-gradient-to-r from-orange-400 via-orange-500 to-red-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
              {!dropoffs.length && <p className="text-sm text-gray-500">No drop-off data yet.</p>}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Activity feed</h3>
              <p className="text-sm text-gray-500">Recent learner events</p>
            </div>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mt-4 max-h-[480px] space-y-4 overflow-y-auto pr-1">
            {activityFeed.map((event) => (
              <div key={event.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">{event.title}</p>
                  <span className="text-xs text-gray-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{event.detail}</p>
                <span
                  className={`mt-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    event.type === 'completion'
                      ? 'bg-green-50 text-green-700'
                      : event.type === 'login'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-orange-50 text-orange-700'
                  }`}
                >
                  {event.type}
                </span>
              </div>
            ))}
            {!activityFeed.length && (
              <p className="text-sm text-gray-500">No realtime events to display yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default AnalyticsDashboard
