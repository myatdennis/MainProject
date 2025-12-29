// Lightweight admin analytics route
// GET /api/admin/analytics?course_id=<uuid>&org_id=<uuid>&since=<ISO>&until=<ISO>

import express from 'express'
import sql from '../db.js'
import { withHttpError } from '../middleware/apiErrorHandler.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const { course_id, organization_id, since, until } = req.query

    const surveyFilters = []
    if (course_id) {
      surveyFilters.push(sql`course_id = ${course_id}`)
    }
    if (organization_id) {
      surveyFilters.push(sql`organization_id = ${organization_id}`)
    }

    const sinceDate = since ? new Date(since) : null
    const untilDate = until ? new Date(until) : null

    if ((since && Number.isNaN(sinceDate.getTime())) || (until && Number.isNaN(untilDate.getTime()))) {
      return res.status(400).json({ error: 'invalid_date_range' })
    }

    if (sinceDate) {
      surveyFilters.push(sql`created_at >= ${sinceDate.toISOString()}`)
    }
    if (untilDate) {
      surveyFilters.push(sql`created_at <= ${untilDate.toISOString()}`)
    }

    const surveyWhereClause = surveyFilters.length
      ? sql`where ${sql.join(surveyFilters, sql` and `)}`
      : sql``

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
      select course_id, organization_id, count(*) as responses, avg(rating) as avg_rating
      from public.survey_responses
      ${surveyWhereClause}
      group by course_id, organization_id
      order by responses desc
      limit 50
    `

    res.json({ overview: overview[0] || {}, courses: courseAggs, dropoffs, surveySummary })
  } catch (err) {
    console.error('[admin-analytics] error', err)
    next(withHttpError(err, 500, 'admin_analytics_failed'))
  }
})

export default router
