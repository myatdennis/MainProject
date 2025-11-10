#!/usr/bin/env node
import sql from '../server/db.js'

async function run() {
  try {
    console.log('Running verification queries...')

    const overview = await sql`SELECT * FROM public.view_admin_overview`
    console.log('\nview_admin_overview:')
    console.dir(overview, { depth: null })

    const courses = await sql`SELECT * FROM public.view_course_completion_rate ORDER BY completion_percent DESC LIMIT 5`
    console.log('\nview_course_completion_rate (top 5):')
    console.dir(courses, { depth: null })

    const avg = await sql`SELECT * FROM public.view_course_avg_progress LIMIT 5`
    console.log('\nview_course_avg_progress (sample):')
    console.dir(avg, { depth: null })

    const dropoffs = await sql`SELECT * FROM public.view_lesson_dropoff ORDER BY dropoff_percent DESC LIMIT 5`
    console.log('\nview_lesson_dropoff (top 5):')
    console.dir(dropoffs, { depth: null })

    // If there are courses, compute engagement score for up to 3
    const courseIds = await sql`SELECT course_id FROM public.view_course_avg_progress LIMIT 3`
    for (const row of courseIds) {
      try {
        const res = await sql`SELECT public.fn_course_engagement_score(${row.course_id}) AS score`
        console.log(`\nengagement score for ${row.course_id}:`, res[0]?.score)
      } catch (e) {
        console.warn('Failed to compute engagement score for', row.course_id, e.message || e)
      }
    }

    console.log('\nVerification complete.')
  } catch (err) {
    console.error('Verification failed:', err.message || err)
    process.exitCode = 1
  } finally {
    try { await sql.end() } catch(e) {}
  }
}

run()
#!/usr/bin/env node
/* Verify analytics views/functions exist and show sample rows */
import sql from '../server/db.js'

async function run() {
  try {
    console.log('Querying view_admin_overview...')
    const overview = await sql`SELECT * FROM public.view_admin_overview`
    console.log('view_admin_overview:', overview)

    console.log('\nQuerying view_course_completion_rate (limit 5)...')
    const courses = await sql`SELECT * FROM public.view_course_completion_rate LIMIT 5`
    console.log('view_course_completion_rate:', courses)

    console.log('\nQuerying view_course_avg_progress (limit 5)...')
    const avg = await sql`SELECT * FROM public.view_course_avg_progress LIMIT 5`
    console.log('view_course_avg_progress:', avg)

    console.log('\nAttempting engagement scores for up to 3 courses...')
    const courseIds = courses.map(c => c.course_id).slice(0,3)
    for (const id of courseIds) {
      try {
        const res = await sql`SELECT public.fn_course_engagement_score(${id}::uuid) AS score`
        console.log(`engagement for ${id}:`, res)
      } catch (e) {
        console.warn(`fn_course_engagement_score failed for ${id}:`, e.message || e)
      }
    }

  } catch (err) {
    console.error('Verification failed:', err.message || err)
    process.exitCode = 1
  } finally {
    try { await sql.end() } catch (e) {}
  }
}

run()
#!/usr/bin/env node
import sql from '../server/db.js'

async function run() {
  try {
    console.log('Querying view_admin_overview...')
    const overview = await sql`select * from public.view_admin_overview`
    console.log('overview:', JSON.stringify(overview, null, 2))

    console.log('Querying view_course_completion_rate (limit 5)...')
    const courses = await sql`select * from public.view_course_completion_rate limit 5`
    console.log('courses:', JSON.stringify(courses, null, 2))

    console.log('Querying view_lesson_dropoff (limit 5)...')
    const lessons = await sql`select * from public.view_lesson_dropoff limit 5`
    console.log('lessons:', JSON.stringify(lessons, null, 2))

    // Attempt engagement score for up to 3 course_ids
    if (courses.length > 0) {
      for (let i = 0; i < Math.min(3, courses.length); i++) {
        const cid = courses[i].course_id
        try {
          const score = await sql`select public.fn_course_engagement_score(${cid}) as score`
          console.log(`engagement for ${cid}:`, JSON.stringify(score, null, 2))
        } catch (e) {
          console.warn('engagement score call failed for', cid, e.message || e)
        }
      }
    }
  } catch (err) {
    console.error('Verification failed:', err.message || err)
    process.exitCode = 1
  } finally {
    try { await sql.end({ timeout: 1000 }) } catch (e) {}
  }
}

run()
#!/usr/bin/env node
import sql from '../server/db.js'

async function verify() {
  try {
    console.log('Querying view_admin_overview...')
    const overview = await sql`SELECT * FROM public.view_admin_overview`
    console.log('OVERVIEW:', overview)

    console.log('Querying view_course_completion_rate (limit 5)...')
    const rates = await sql`SELECT * FROM public.view_course_completion_rate LIMIT 5`
    console.log('COMPLETION RATES:', rates)

    if (rates.length) {
      for (const row of rates.slice(0,3)) {
        try {
          const score = await sql`SELECT public.fn_course_engagement_score(${row.course_id}) AS score`
          console.log(`ENGAGEMENT SCORE for ${row.course_id}:`, score)
        } catch (e) {
          console.warn('Failed to fetch engagement score for', row.course_id, e.message)
        }
      }
    }

  } catch (err) {
    console.error('Verification failed:', err)
    process.exitCode = 1
  } finally {
    await sql.end({ timeout: 1000 })
  }
}

verify()
