// Admin analytics route — queries real tables only (no generated views).
// GET /api/admin/analytics?course_id=<uuid>&org_id=<uuid>&since=<ISO>&until=<ISO>

import express from 'express'
import sql from '../db.js'
import { withHttpError } from '../middleware/apiErrorHandler.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const { course_id, organization_id, since, until } = req.query

    const sinceDate = since ? new Date(since) : null
    const untilDate = until ? new Date(until) : null

    if ((since && Number.isNaN(sinceDate?.getTime())) || (until && Number.isNaN(untilDate?.getTime()))) {
      return res.status(400).json({ error: 'invalid_date_range' })
    }

    // ── Overview ─────────────────────────────────────────────────────────
    // Active learners = distinct users who have any course progress record
    const activeLearnerRows = await sql`
      select count(distinct user_id)::int as total_active_learners
      from public.user_course_progress
    `
    // Total orgs with at least one active member
    const orgCountRows = await sql`
      select count(*)::int as total_orgs
      from public.organizations
      where status = 'active'
    `
    // Published courses
    const courseCountRows = await sql`
      select count(*)::int as total_courses
      from public.courses
      where status = 'published'
    `
    // Platform-wide average progress and completion rate
    const progressRows = await sql`
      select
        round(avg(progress)::numeric, 1)     as platform_avg_progress,
        round(
          100.0 * count(*) filter (where completed = true)
          / nullif(count(*), 0)
        , 1)                                 as platform_avg_completion
      from public.user_course_progress
    `

    const overview = {
      total_active_learners: activeLearnerRows[0]?.total_active_learners ?? 0,
      total_orgs:            orgCountRows[0]?.total_orgs ?? 0,
      total_courses:         courseCountRows[0]?.total_courses ?? 0,
      platform_avg_progress:    Number(progressRows[0]?.platform_avg_progress ?? 0),
      platform_avg_completion:  Number(progressRows[0]?.platform_avg_completion ?? 0),
    }

    // ── Course-level aggregates ───────────────────────────────────────────
    let courseAggs
    if (course_id) {
      courseAggs = await sql`
        select
          ucp.course_id::text                          as course_id,
          count(distinct ucp.user_id)::int             as total_users,
          count(*) filter (where ucp.completed)::int   as completed_count,
          round(
            100.0 * count(*) filter (where ucp.completed)
            / nullif(count(*), 0)
          , 1)::float                                  as completion_percent,
          round(avg(ucp.progress)::numeric, 1)::float  as avg_progress
        from public.user_course_progress ucp
        where ucp.course_id = ${course_id}::uuid
        group by ucp.course_id
      `
    } else {
      const orgFilter = organization_id
        ? sql`and ucp.organization_id = ${organization_id}::uuid`
        : sql``
      courseAggs = await sql`
        select
          ucp.course_id::text                          as course_id,
          count(distinct ucp.user_id)::int             as total_users,
          count(*) filter (where ucp.completed)::int   as completed_count,
          round(
            100.0 * count(*) filter (where ucp.completed)
            / nullif(count(*), 0)
          , 1)::float                                  as completion_percent,
          round(avg(ucp.progress)::numeric, 1)::float  as avg_progress
        from public.user_course_progress ucp
        where 1=1 ${orgFilter}
        group by ucp.course_id
        order by completion_percent desc
        limit 50
      `
    }

    // ── Lesson-level dropoffs ─────────────────────────────────────────────
    // Derive from user_lesson_progress: started = any record, completed = status='completed'
    const dropoffFilters = []
    if (course_id) dropoffFilters.push(sql`ulp.course_id = ${course_id}`)
    const dropoffWhere = dropoffFilters.length ? sql`where ${sql.join(dropoffFilters, sql` and `)}` : sql``

    const dropoffs = await sql`
      select
        ulp.course_id::text                                      as course_id,
        ulp.lesson_id::text                                      as lesson_id,
        count(*)::int                                            as started_count,
        count(*) filter (where ulp.status = 'completed')::int   as completed_count,
        round(
          100.0 * count(*) filter (where ulp.status <> 'completed')
          / nullif(count(*), 0)
        , 1)::float                                              as dropoff_percent
      from public.user_lesson_progress ulp
      ${dropoffWhere}
      group by ulp.course_id, ulp.lesson_id
      order by dropoff_percent desc
      limit 20
    `

    // ── Engagement trend (events per day) ────────────────────────────────
    const eventFilters = []
    if (course_id) eventFilters.push(sql`ae.course_id = ${course_id}`)
    if (organization_id) eventFilters.push(sql`ae.org_id = ${organization_id}::uuid`)
    if (sinceDate)  eventFilters.push(sql`ae.created_at >= ${sinceDate.toISOString()}`)
    if (untilDate)  eventFilters.push(sql`ae.created_at <= ${untilDate.toISOString()}`)
    const eventWhere = eventFilters.length ? sql`where ${sql.join(eventFilters, sql` and `)}` : sql``

    const engagementTrend = await sql`
      select
        date_trunc('day', ae.created_at)::date::text as date,
        count(*)::int                                 as events,
        count(distinct ae.user_id)::int               as unique_users,
        count(*) filter (
          where ae.event_type in ('lesson_completed','course_completed','quiz_passed')
        )::int                                        as completions
      from public.analytics_events ae
      ${eventWhere}
      group by date_trunc('day', ae.created_at)
      order by 1
      limit 90
    `

    // ── Hourly heatmap (day-of-week × 2-hour bucket) ─────────────────────
    const heatmap = await sql`
      select
        extract(dow from ae.created_at)::int   as dow,
        floor(extract(hour from ae.created_at) / 2)::int as bucket,
        count(*)::int                          as events
      from public.analytics_events ae
      ${eventWhere}
      group by dow, bucket
      order by dow, bucket
    `

    // ── Top orgs by learner activity ──────────────────────────────────────
    const topOrgs = await sql`
      select
        o.id::text           as org_id,
        o.name               as org_name,
        count(distinct ucp.user_id)::int         as total_learners,
        round(
          100.0 * count(*) filter (where ucp.completed)
          / nullif(count(*), 0)
        , 1)::float                              as completion_rate
      from public.organizations o
      join public.user_course_progress ucp on ucp.organization_id = o.id
      group by o.id, o.name
      order by total_learners desc
      limit 10
    `

    // ── Per-course performance detail (for the content table) ────────────
    const courseDetail = await sql`
      select
        c.id::text                                          as course_id,
        c.title                                             as course_title,
        count(distinct ucp.user_id)::int                    as total_learners,
        count(*) filter (where ucp.completed)::int          as completed_count,
        round(
          100.0 * count(*) filter (where ucp.completed)
          / nullif(count(*), 0)
        , 1)::float                                         as completion_percent,
        round(avg(ucp.progress)::numeric, 1)::float         as avg_progress,
        round(avg(ucp.time_spent_s)::numeric / 60.0, 0)::int as avg_time_minutes,
        count(distinct qa.id)::int                          as quiz_attempts
      from public.courses c
      left join public.user_course_progress ucp on ucp.course_id = c.id
      left join public.quiz_attempts qa on qa.course_id = c.id
      where c.status = 'published'
      group by c.id, c.title
      order by total_learners desc
      limit 50
    `

    res.json({
      overview,
      courses:        courseAggs,
      dropoffs,
      engagementTrend,
      heatmap,
      topOrgs,
      courseDetail,
      surveySummary:  [],   // no survey_responses table yet; kept for API compat
    })
  } catch (err) {
    console.error('[admin-analytics] error', err)
    next(withHttpError(err, 500, 'admin_analytics_failed'))
  }
})

export default router
