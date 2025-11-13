#!/usr/bin/env node
import sql from '../server/db.js'

async function verify() {
  try {
    console.log('Querying view_admin_overview...')
    const overview = await sql`SELECT * FROM public.view_admin_overview`
    console.log('OVERVIEW:', JSON.stringify(overview, null, 2))

    console.log('\nQuerying view_course_completion_rate (limit 5)...')
    const rates = await sql`SELECT * FROM public.view_course_completion_rate LIMIT 5`
    console.log('COMPLETION RATES:', JSON.stringify(rates, null, 2))

    console.log('\nQuerying view_lesson_dropoff (limit 5)...')
    const lessons = await sql`SELECT * FROM public.view_lesson_dropoff LIMIT 5`
    console.log('LESSONS:', JSON.stringify(lessons, null, 2))

    if (rates && rates.length) {
      for (const row of rates.slice(0, 3)) {
        try {
          const score = await sql`SELECT public.fn_course_engagement_score(${row.course_id}) AS score`
          console.log(`ENGAGEMENT SCORE for ${row.course_id}:`, JSON.stringify(score, null, 2))
        } catch (e) {
          console.warn('Failed to fetch engagement score for', row.course_id, e?.message || e)
        }
      }
    }

    console.log('\nVerification complete.')
  } catch (err) {
    console.error('Verification failed:', err?.message || err)
    process.exitCode = 1
  } finally {
    try { await sql.end({ timeout: 1000 }) } catch (e) { /** ignore */ }
  }
}

verify();
