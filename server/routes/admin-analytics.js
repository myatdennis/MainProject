// Lightweight admin analytics route
// GET /api/admin/analytics?course_id=<uuid>&org_id=<uuid>&since=<ISO>&until=<ISO>

import express from 'express'
import sql from '../db.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const { course_id, org_id, since, until } = req.query

    // Basic filters - expand with secure RLS checks later
    const whereClauses = []
    const params = {}
    if (course_id) {
      whereClauses.push(sql`course_id = ${course_id}`)
    }
    if (org_id) {
      whereClauses.push(sql`org_id = ${org_id}`)
    }

    // Admin overview
    const overview = await sql`select * from public.view_admin_overview limit 1`

    // Course-level aggregates (if course_id provided, return details, else top courses)
    let courseAggs
    if (course_id) {
      courseAggs = await sql`select vc.course_id, vc.total_users, vc.completed_count, vc.completion_percent, vp.avg_progress, fn_course_engagement_score(vc.course_id) as engagement_score
                              from public.view_course_completion_rate vc
                              left join public.view_course_avg_progress vp on vp.course_id = vc.course_id
                              where vc.course_id = ${course_id}`
    } else {
      courseAggs = await sql`select vc.course_id, vc.total_users, vc.completed_count, vc.completion_percent, vp.avg_progress
                              from public.view_course_completion_rate vc
                              left join public.view_course_avg_progress vp on vp.course_id = vc.course_id
                              order by vc.completion_percent desc limit 50`
    }

    // Top dropoffs (sample)
    const dropoffs = await sql`select lesson_id, course_id, started_count, completed_count, dropoff_percent from public.view_lesson_dropoff order by dropoff_percent desc limit 20`

    // Survey summary (counts and average ratings)
    const surveySummary = await sql`
      select course_id, count(*) as responses, avg(rating) as avg_rating
      from public.survey_responses
      group by course_id
      order by responses desc
      limit 50
    `

    res.json({ overview: overview[0] || {}, courses: courseAggs, dropoffs, surveySummary })
  } catch (err) {
    console.error('[admin-analytics] error', err)
    res.status(500).json({ error: 'internal_error' })
  }
})

export default router
