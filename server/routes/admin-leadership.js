import express from 'express'
import fetch from 'node-fetch'
import sql from '../db.js'
import { withHttpError } from '../middleware/apiErrorHandler.js'

const router = express.Router()

const clampNumber = (value, min = 0, max = 100) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, Number(value)))
}

const parseOrgId = (value) => (typeof value === 'string' && value.trim().length ? value.trim() : null)

const mapHealthRow = (row) => ({
  orgId: row.org_id,
  name: row.name,
  activeLearners: Number(row.active_learners ?? 0),
  completionRate: Number(row.completion_rate ?? 0),
  avgProgress: Number(row.avg_progress ?? 0),
  avgSurveyRating: Number(row.avg_survey_rating ?? 0),
  surveyResponses: Number(row.survey_responses ?? 0),
  overdueAssignments: Number(row.overdue_assignments ?? 0),
  worstDropoff: Number(row.worst_dropoff ?? 0),
})

const fetchHealthRows = async (orgId) => {
  const filter = orgId ? sql`where org_id = ${orgId}` : sql``
  const rows = await sql`
    select *
    from public.view_org_leadership_health
    ${filter}
    order by completion_rate desc nulls last
    limit ${orgId ? 1 : 50}
  `
  return rows.map(mapHealthRow)
}

const hasSimilarOpenRecommendation = (existing, candidate) =>
  existing.some(
    (row) =>
      row.status !== 'resolved' &&
      row.title.toLowerCase() === candidate.title.toLowerCase() &&
      row.category === candidate.category,
  )

const buildHeuristicRecommendations = (metrics) => {
  const suggestions = []
  if (metrics.completionRate < 75) {
    suggestions.push({
      title: 'Stabilize completion momentum',
      summary: `Completion is ${metrics.completionRate}% across ${metrics.activeLearners} active learners. Schedule midpoint coaching touchpoints and automated nudges to protect momentum through the next major module.`,
      category: 'completion',
      priority: metrics.completionRate < 55 ? 'high' : 'medium',
      impact: 'Improves cohort velocity and protects graduation targets.',
      confidence: clampNumber(70 + (75 - metrics.completionRate) * 0.4),
      tags: ['completion', 'nudges', 'coaching'],
      data_points: {
        completion_rate: metrics.completionRate,
        avg_progress: metrics.avgProgress,
      },
    })
  }

  if (metrics.avgSurveyRating < 4) {
    suggestions.push({
      title: 'Run a leadership listening pulse',
      summary: `Survey satisfaction is ${metrics.avgSurveyRating.toFixed(2)} with ${metrics.surveyResponses} responses. Launch a 3-question qualitative pulse and share a recap within 5 days.`,
      category: 'experience',
      priority: 'medium',
      impact: 'Captures high-signal qualitative input before renewal conversations.',
      confidence: clampNumber(65 + (4 - metrics.avgSurveyRating) * 8),
      tags: ['surveys', 'experience'],
      data_points: {
        avg_survey_rating: metrics.avgSurveyRating,
        survey_responses: metrics.surveyResponses,
      },
    })
  }

  if (metrics.worstDropoff > 40) {
    suggestions.push({
      title: 'Patch the steepest lesson drop-off',
      summary: `A ${metrics.worstDropoff}% drop occurs within the most complex lesson. Embed a 90-second context video and checkpoint worksheet to keep learners moving.`,
      category: 'content',
      priority: metrics.worstDropoff > 60 ? 'high' : 'medium',
      impact: 'Reduces abandonment on critical leadership scenarios.',
      confidence: clampNumber(70 + (metrics.worstDropoff - 40) * 0.5),
      tags: ['dropoff', 'content'],
      data_points: {
        worst_dropoff: metrics.worstDropoff,
      },
    })
  }

  if (metrics.overdueAssignments > 0) {
    suggestions.push({
      title: 'Resolve overdue action plans',
      summary: `${metrics.overdueAssignments} leadership assignments are overdue. Send accountability digests to managers and auto-extend blockers with a one-click CTA.`,
      category: 'accountability',
      priority: metrics.overdueAssignments > 5 ? 'high' : 'medium',
      impact: 'Keeps action plans aligned with operational cadence.',
      confidence: clampNumber(60 + metrics.overdueAssignments * 5),
      tags: ['assignments', 'accountability'],
      data_points: {
        overdue_assignments: metrics.overdueAssignments,
      },
    })
  }

  if (metrics.avgProgress < 60 && metrics.activeLearners > 0) {
    suggestions.push({
      title: 'Re-segment learning cohorts',
      summary: `Avg progress is ${metrics.avgProgress}% with ${metrics.activeLearners} participants. Split learners into "accelerators" and "builders" to tailor pacing and protect morale.`,
      category: 'coaching',
      priority: 'medium',
      impact: 'Aligns facilitation cadence with real learner momentum.',
      confidence: clampNumber(65 + (60 - metrics.avgProgress) * 0.4),
      tags: ['cohorts', 'momentum'],
      data_points: {
        avg_progress: metrics.avgProgress,
        active_learners: metrics.activeLearners,
      },
    })
  }

  if (metrics.activeLearners < 15) {
    suggestions.push({
      title: 'Spotlight success stories',
      summary: `Only ${metrics.activeLearners} active learners are visible in telemetry. Showcase 2 quick-win stories in Slack/email to inspire dormant members.`,
      category: 'engagement',
      priority: 'low',
      impact: 'Creates social proof that reactivates observers.',
      confidence: 62,
      tags: ['engagement', 'comms'],
      data_points: {
        active_learners: metrics.activeLearners,
      },
    })
  }

  return suggestions
}

const callAiProvider = async (metrics, instructions = '') => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || null
  if (!OPENAI_KEY) return null

  const prompt = [
    'You are an executive leadership coach generating LMS recommendations.',
    'Return a JSON array (max 3 items). Each item must have title, summary,' +
      ' category, priority (low|medium|high), impact, confidence (0-100 number), and tags (array of strings).',
    'Use the following metrics to anchor insights:',
    JSON.stringify(metrics, null, 2),
    'Instructions:',
    instructions || 'Focus on practical cohort-level nudges the admin team can implement within 2 weeks.',
  ].join('\n\n')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    console.warn('[leadership-ai] provider error', details)
    return null
  }

  try {
    const json = await response.json()
    const text = json?.choices?.[0]?.message?.content ?? ''
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start === -1 || end === -1) return null
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(parsed)) return null
    return parsed
      .map((item) => ({
        title: item.title,
        summary: item.summary,
        category: item.category || 'insight',
        priority: (item.priority || 'medium').toLowerCase(),
        impact: item.impact || '',
        confidence: clampNumber(Number(item.confidence ?? 70)),
        tags: Array.isArray(item.tags) ? item.tags : [],
        data_points: item.data_points || {},
      }))
      .filter((item) => typeof item.title === 'string' && item.title.trim().length)
  } catch (error) {
    console.warn('[leadership-ai] failed to parse ai payload', error)
    return null
  }
}

router.get('/health', async (req, res, next) => {
  try {
    const orgId = parseOrgId(req.query.orgId || req.query.org_id)
    const rows = await fetchHealthRows(orgId)
    res.json({ data: rows, count: rows.length })
  } catch (error) {
    next(withHttpError(error, 500, 'leadership_health_failed'))
  }
})

router.get('/:orgId/recommendations', async (req, res, next) => {
  try {
    const orgId = parseOrgId(req.params.orgId)
    if (!orgId) {
      res.status(400).json({ error: 'org_id_required' })
      return
    }
    const rows = await sql`
      select *
      from public.organization_leadership_recommendations
      where org_id = ${orgId}
      order by case when status = 'resolved' then 1 else 0 end, priority desc, generated_at desc
      limit 100
    `
    res.json({ data: rows })
  } catch (error) {
    next(withHttpError(error, 500, 'leadership_recommendations_failed'))
  }
})

router.post('/:orgId/recommendations', async (req, res, next) => {
  try {
    const orgId = parseOrgId(req.params.orgId)
    if (!orgId) {
      res.status(400).json({ error: 'org_id_required' })
      return
    }

    const limit = Math.max(1, Math.min(5, Number(req.body?.limit ?? 3)))
    const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions : ''

    const [health] = await fetchHealthRows(orgId)
    if (!health) {
      res.status(404).json({ error: 'org_not_found_or_no_metrics' })
      return
    }

    const existing = await sql`
      select id, title, category, status
      from public.organization_leadership_recommendations
      where org_id = ${orgId}
    `

      const aiCandidates = await callAiProvider(health, instructions)
      const heuristicCandidates = buildHeuristicRecommendations(health)

      const withSource = (items, source) =>
      (items || []).map((item) => ({
        ...item,
        generated_by: source,
      }))

    const merged = [
        ...withSource(aiCandidates, 'ai'),
        ...withSource(heuristicCandidates, 'heuristic'),
    ]

  const fresh = merged.filter((suggestion) => !hasSimilarOpenRecommendation(existing, suggestion)).slice(0, limit)

    if (!fresh.length) {
        res.json({
          data: [],
          message: 'no_new_recommendations',
          mode: (aiCandidates?.length ?? 0) > 0 ? 'ai' : 'heuristic',
        })
      return
    }

    const inserted = []
    for (const suggestion of fresh) {
      const [row] = await sql`
        insert into public.organization_leadership_recommendations (
          org_id,
          title,
          summary,
          category,
          priority,
          impact,
          confidence,
          tags,
          data_points,
          generated_by,
          ai_model,
          ai_version
        ) values (
          ${orgId},
          ${suggestion.title},
          ${suggestion.summary},
          ${suggestion.category},
          ${suggestion.priority},
          ${suggestion.impact},
          ${suggestion.confidence},
          ${suggestion.tags ?? []},
          ${suggestion.data_points ?? {}},
          ${suggestion.generated_by},
          ${suggestion.generated_by === 'ai' ? process.env.OPENAI_MODEL || 'gpt-4o-mini' : null},
          ${suggestion.generated_by === 'ai' ? process.env.OPENAI_API_VERSION || null : null}
        )
        returning *
      `
      inserted.push(row)
      existing.push({ title: row.title, category: row.category, status: row.status })
    }

    const mode = inserted.every((item) => item.generated_by === 'ai')
      ? 'ai'
      : inserted.every((item) => item.generated_by === 'heuristic')
      ? 'heuristic'
      : 'mixed'

    res.json({ data: inserted, mode })
  } catch (error) {
    next(withHttpError(error, 500, 'leadership_recommendations_generate_failed'))
  }
})

const ALLOWED_STATUSES = new Set(['open', 'planned', 'in_progress', 'blocked', 'resolved', 'dismissed'])

router.patch('/recommendations/:recommendationId', async (req, res, next) => {
  try {
    const recommendationId = req.params.recommendationId
    if (!recommendationId) {
      res.status(400).json({ error: 'recommendation_id_required' })
      return
    }

    const updates = {}
    const status = typeof req.body?.status === 'string' ? req.body.status.toLowerCase() : null
    if (status) {
      if (!ALLOWED_STATUSES.has(status)) {
        res.status(400).json({ error: 'invalid_status' })
        return
      }
      updates.status = status
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString()
      }
    }

    if (typeof req.body?.resolutionNotes === 'string') {
      updates.resolution_notes = req.body.resolutionNotes
    }

    if (!Object.keys(updates).length) {
      res.status(400).json({ error: 'no_updates_provided' })
      return
    }

    updates.updated_at = new Date().toISOString()

    const setClauses = []
    if ('status' in updates) setClauses.push(sql`status = ${updates.status}`)
    if ('resolved_at' in updates) setClauses.push(sql`resolved_at = ${updates.resolved_at}`)
    if ('resolution_notes' in updates) setClauses.push(sql`resolution_notes = ${updates.resolution_notes}`)
    setClauses.push(sql`updated_at = ${updates.updated_at}`)

    const [row] = await sql`
      update public.organization_leadership_recommendations
      set ${sql.join(setClauses, sql`, `)}
      where id = ${recommendationId}
      returning *
    `

    if (!row) {
      res.status(404).json({ error: 'recommendation_not_found' })
      return
    }

    res.json({ data: row })
  } catch (error) {
    next(withHttpError(error, 500, 'leadership_recommendation_update_failed'))
  }
})

export default router
