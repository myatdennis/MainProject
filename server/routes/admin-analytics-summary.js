import express from 'express'
import sql from '../db.js'
import fetch from 'node-fetch'
import { withHttpError } from '../middleware/apiErrorHandler.js'
import { withCache } from '../services/cacheService.js'

const router = express.Router()

// POST /api/admin/analytics/summary
// Body: { course_id?, timeframe: { since, until }, provider: 'openai' }
router.post('/', async (req, res, next) => {
  try {
    const { course_id, timeframe = {} } = req.body || {}
    const cacheKey = `analytics-summary:${course_id || 'all'}:${timeframe.since || 'none'}:${timeframe.until || 'none'}`
    const ttlSeconds = Number(process.env.ANALYTICS_CACHE_TTL || 120)

    const payload = await withCache(
      cacheKey,
      async () => {
        // Overview from real tables (no generated views)
        const overviewRows = await sql`
          select
            count(distinct ucp.user_id)::int                           as total_active_learners,
            count(distinct o.id)::int                                  as total_orgs,
            count(distinct c.id) filter (where c.status='published')::int as total_courses,
            round(avg(ucp.progress)::numeric, 1)::float                as platform_avg_progress,
            round(100.0 * count(*) filter (where ucp.completed) / nullif(count(*),0), 1)::float as platform_avg_completion
          from public.user_course_progress ucp
          full outer join public.organizations o on true
          full outer join public.courses c on true
          where o.status = 'active'
        `

        const courseAgg = course_id
          ? await sql`
              select
                ucp.course_id::text,
                count(distinct ucp.user_id)::int as total_users,
                count(*) filter (where ucp.completed)::int as completed_count,
                round(100.0 * count(*) filter (where ucp.completed) / nullif(count(*),0), 1)::float as completion_percent,
                round(avg(ucp.progress)::numeric, 1)::float as avg_progress
              from public.user_course_progress ucp
              where ucp.course_id = ${course_id}::uuid
              group by ucp.course_id
            `
          : []

        const dropoffs = await sql`
          select
            ulp.course_id::text as course_id,
            ulp.lesson_id::text as lesson_id,
            count(*)::int as started_count,
            count(*) filter (where ulp.status = 'completed')::int as completed_count,
            round(100.0 * count(*) filter (where ulp.status <> 'completed') / nullif(count(*),0), 1)::float as dropoff_percent
          from public.user_lesson_progress ulp
          group by ulp.course_id, ulp.lesson_id
          order by dropoff_percent desc
          limit 10
        `

        return {
          overview: overviewRows[0] || {},
          course: courseAgg[0] || null,
          top_dropoffs: dropoffs || [],
        }
      },
      { ttlSeconds }
    )

    // If OPENAI_API_KEY is available, forward to OpenAI for a short summary (optional)
    const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || null
    if (!OPENAI_KEY) {
      // Return a prompt template and an example summary instead
      const prompt = `Summarize the key engagement insights for the following data:\n${JSON.stringify(payload, null, 2)}\nProvide 3 key takeaways, 2 concerns, and 2 recommended actions.`
      const sample = {
        takeaways: [
          'Overall completion rate is healthy (~62%) across published courses.',
          'Lesson X shows a 45% dropoff early in module 2 — consider reducing video length or adding an interactive checkpoint.',
          'Average progress is highest in courses with short micro-lessons (under 10 minutes).'
        ],
        concerns: ['Low response rate on post-course surveys (12%)', 'Engagement drops around lesson 3 in multiple courses'],
        actions: ['Introduce short reflection prompts at 50% of lesson completion', 'A/B test a stricter prerequisite check for advanced modules']
      }
      res.json({ prompt, sample, payload })
      return
    }

    // Call OpenAI (if configured) — one-shot completion. The server must have network access and the key.
    // NOTE: this is optional; the endpoint will still return a prompt/sample if no key configured.
    const prompt = `Summarize the key engagement insights for the following data:\n${JSON.stringify(payload, null, 2)}\nProvide 3 key takeaways, 2 concerns, and 2 recommended actions.`

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      credentials: 'include',
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 400 })
    })

    if (!r.ok) {
      const errText = await r.text()
      console.error('OpenAI error', errText)
      res.status(502).json({ error: 'ai_provider_failed', details: errText })
      return
    }

    const json = await r.json()
    const aiText = json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text ?? null
    res.json({ ai: aiText, payload })
  } catch (err) {
    console.error('[admin-analytics-summary] error', err)
    next(withHttpError(err, 500, 'analytics_summary_failed'))
  }
})

export default router
