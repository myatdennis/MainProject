import express from 'express'
import sql from '../db.js'
import { withHttpError } from '../middleware/apiErrorHandler.js'

const router = express.Router()

// GET /api/admin/analytics/export?course_id=&org_id=
router.get('/', async (req, res, next) => {
  try {
    const { course_id } = req.query

    // Reuse the same aggregates as the main analytics route
    let rows
    if (course_id) {
      rows = await sql`
        select vc.course_id, vc.total_users, vc.completed_count, vc.completion_percent, vp.avg_progress
        from public.view_course_completion_rate vc
        left join public.view_course_avg_progress vp on vp.course_id = vc.course_id
        where vc.course_id = ${course_id}
      `
    } else {
      rows = await sql`
        select vc.course_id, vc.total_users, vc.completed_count, vc.completion_percent, vp.avg_progress
        from public.view_course_completion_rate vc
        left join public.view_course_avg_progress vp on vp.course_id = vc.course_id
        order by vc.completion_percent desc
        limit 500
      `
    }

    const records = (rows || []).map((r) => ({
      course_id: r.course_id,
      total_users: r.total_users ?? 0,
      completed_count: r.completed_count ?? 0,
      completion_percent: r.completion_percent ?? 0,
      avg_progress: r.avg_progress ?? 0
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
