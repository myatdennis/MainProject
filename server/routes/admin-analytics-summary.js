import express from 'express'
import sql from '../db.js'
import fetch from 'node-fetch'

const router = express.Router()

// POST /api/admin/analytics/summary
// Body: { course_id?, timeframe: { since, until }, provider: 'openai' }
router.post('/', async (req, res) => {
  try {
    const { course_id, timeframe = {} } = req.body || {}

    // Gather simple aggregates
    const overviewRows = await sql`select * from public.view_admin_overview limit 1`
    const courseAgg = course_id
      ? await sql`select vc.course_id, vc.total_users, vc.completed_count, vc.completion_percent, vp.avg_progress from public.view_course_completion_rate vc left join public.view_course_avg_progress vp on vp.course_id = vc.course_id where vc.course_id = ${course_id}`
      : []

    const dropoffs = await sql`select lesson_id, course_id, started_count, completed_count, dropoff_percent from public.view_lesson_dropoff order by dropoff_percent desc limit 10`

    const payload = {
      overview: overviewRows[0] || {},
      course: courseAgg[0] || null,
      top_dropoffs: dropoffs || []
    }

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
    res.status(500).json({ error: 'summary_failed' })
  }
})

export default router
