import express from 'express'
import sql from '../db.js'
import { withHttpError } from '../middleware/apiErrorHandler.js'

const router = express.Router()

// GET /api/admin/analytics/export?course_id=&org_id=
router.get('/', async (req, res, next) => {
  try {
    const { course_id, organization_id } = req.query

    // Build real-table aggregates (no generated views required)
    let rows
    if (course_id) {
      rows = await sql`
        select
          c.title                                             as course_title,
          ucp.course_id::text                                 as course_id,
          count(distinct ucp.user_id)::int                    as total_users,
          count(*) filter (where ucp.completed)::int          as completed_count,
          round(100.0 * count(*) filter (where ucp.completed) / nullif(count(*),0), 1)::float as completion_percent,
          round(avg(ucp.progress)::numeric, 1)::float         as avg_progress,
          round(avg(ucp.time_spent_s)::numeric / 60.0, 0)::int as avg_time_minutes
        from public.user_course_progress ucp
        join public.courses c on c.id = ucp.course_id
        where ucp.course_id = ${course_id}::uuid
        group by c.title, ucp.course_id
      `
    } else {
      const orgFilter = organization_id
        ? sql`and ucp.organization_id = ${organization_id}::uuid`
        : sql``
      rows = await sql`
        select
          c.title                                             as course_title,
          ucp.course_id::text                                 as course_id,
          count(distinct ucp.user_id)::int                    as total_users,
          count(*) filter (where ucp.completed)::int          as completed_count,
          round(100.0 * count(*) filter (where ucp.completed) / nullif(count(*),0), 1)::float as completion_percent,
          round(avg(ucp.progress)::numeric, 1)::float         as avg_progress,
          round(avg(ucp.time_spent_s)::numeric / 60.0, 0)::int as avg_time_minutes
        from public.user_course_progress ucp
        join public.courses c on c.id = ucp.course_id
        where 1=1 ${orgFilter}
        group by c.title, ucp.course_id
        order by completion_percent desc
        limit 500
      `
    }

    const records = (rows || []).map((r) => ({
      course_title: r.course_title ?? '',
      course_id: r.course_id,
      total_users: r.total_users ?? 0,
      completed_count: r.completed_count ?? 0,
      completion_percent: r.completion_percent ?? 0,
      avg_progress: r.avg_progress ?? 0,
      avg_time_minutes: r.avg_time_minutes ?? 0,
    }))

    // Simple CSV serializer (no external dependency) — safe for small exports
    const headers = Object.keys(records[0] || { course_id: '', total_users: '', completed_count: '', completion_percent: '', avg_progress: '' })
    const escape = (v) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const lines = [headers.join(',')]
    for (const rec of records) {
      lines.push(headers.map((h) => escape(rec[h])).join(','))
    }
    const csv = lines.join('\n')
    const filename = `analytics_export_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.csv`
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  } catch (err) {
    console.error('[admin-analytics-export] error', err)
    next(withHttpError(err, 500, 'analytics_export_failed'))
  }
})

export default router
