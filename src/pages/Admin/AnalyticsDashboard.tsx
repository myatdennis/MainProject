import React, { useEffect, useState, lazy, Suspense } from 'react'
import { getSupabase } from '../../lib/supabase'
const CompletionChart = lazy(() => import('../../components/Analytics/CompletionChart'));

type Overview = {
  total_active_learners?: number
  total_orgs?: number
  total_courses?: number
  platform_avg_progress?: number
  platform_avg_completion?: number
}

const AnalyticsDashboard: React.FC = () => {
  const [overview, setOverview] = useState<Overview>({})
  const [courses, setCourses] = useState<any[]>([])
  const [dropoffs, setDropoffs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/analytics')
      const json = await res.json()
      setOverview(json.overview || {})
      setCourses(Array.isArray(json.courses) ? json.courses : [])
      setDropoffs(Array.isArray(json.dropoffs) ? json.dropoffs : [])
    } catch (err) {
      console.error('Failed to load analytics', err)
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
    const a = document.createElement('a')
    a.href = '/api/admin/analytics/export'
    a.download = 'analytics.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const requestSummary = async () => {
    try {
      const res = await fetch('/api/admin/analytics/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const json = await res.json()
      alert(JSON.stringify(json.sample || json.ai || json.prompt, null, 2))
    } catch (err) {
      console.error('Summary request failed', err)
      alert('Failed to generate summary')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Admin Analytics</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Active learners</div>
          <div style={{ fontSize: 20 }}>{overview.total_active_learners ?? '—'}</div>
        </div>
        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Orgs</div>
          <div style={{ fontSize: 20 }}>{overview.total_orgs ?? '—'}</div>
        </div>
        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Courses</div>
          <div style={{ fontSize: 20 }}>{overview.total_courses ?? '—'}</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={exportCsv} style={{ marginRight: 8 }}>Export CSV</button>
        <button onClick={requestSummary}>AI Summary</button>
      </div>

      <h3>Top courses (by completion %)</h3>
      {loading ? <div>Loading…</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Course</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Completion %</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Avg progress</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.course_id}>
                <td style={{ padding: 8 }}>{c.course_id}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{c.completion_percent ?? '—'}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{c.avg_progress ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <Suspense fallback={<div>Loading chart…</div>}>
          <CompletionChart data={courses.map((c) => ({ label: c.course_id, value: c.completion_percent }))} />
        </Suspense>
      </div>

      <h3 style={{ marginTop: 20 }}>Top lesson dropoffs</h3>
      <ul>
        {dropoffs.map((d) => (
          <li key={`${d.course_id}_${d.lesson_id}`}>{d.course_id} / {d.lesson_id} — dropoff {d.dropoff_percent}%</li>
        ))}
      </ul>
    </div>
  )
}

export default AnalyticsDashboard
