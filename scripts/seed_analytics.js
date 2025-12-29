#!/usr/bin/env node
/* Seed sample analytics rows to verify dashboard metrics after migration
   Usage: DATABASE_URL=postgres://... node scripts/seed_analytics.js
*/
import { Client } from 'pg'
import { randomUUID } from 'crypto'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('Please set DATABASE_URL environment variable and re-run')
  process.exit(2)
}

const client = new Client({ connectionString: DATABASE_URL })

async function run() {
  await client.connect()
  try {
    console.log('Inserting sample courses/users progress...')
    const courseA = randomUUID()
    const courseB = randomUUID()
    const user1 = randomUUID()
    const user2 = randomUUID()
    const organizationId = randomUUID()

    await client.query(
      `INSERT INTO public.organizations (id, name, contact_email, subscription)
       VALUES ($1, 'Seed Org', 'seed@example.com', 'trial')
       ON CONFLICT (id) DO NOTHING;`,
      [organizationId]
    )

    await client.query(`INSERT INTO public.user_course_progress (id,user_id,course_id,progress,completed,org_id) VALUES
      ($1,$2,$3,95,true,$4),
      ($5,$6,$7,40,false,$4)
    ON CONFLICT DO NOTHING;`, [randomUUID(), user1, courseA, organizationId, randomUUID(), user2, courseB])

    // Insert lesson progress
    await client.query(`INSERT INTO public.user_lesson_progress (id,user_id,course_id,lesson_id,progress,time_spent_seconds,completed,org_id)
      VALUES ($1,$2,$3,$4,100,600,true,$5), ($6,$7,$3,$8,20,120,false,$5)
    ON CONFLICT DO NOTHING;`, [randomUUID(), user1, courseA, randomUUID(), organizationId, randomUUID(), user2, randomUUID()])

    // Insert survey responses
    await client.query(`INSERT INTO public.survey_responses (id,user_id,course_id,question_id,response_text,rating,organization_id)
      VALUES ($1,$2,$3,'q1','Great course',5,$4)
    ON CONFLICT DO NOTHING;`, [randomUUID(), user1, courseA, organizationId])

    // Insert assignment
    await client.query(`INSERT INTO public.assignments (id,user_id,course_id,status,grade)
      VALUES ($1,$2,$3,'graded',92.5)
    ON CONFLICT DO NOTHING;`, [randomUUID(), user1, courseA])

    console.log('Seed complete. Inserted sample rows for two courses and two users.')
  } catch (err) {
    console.error('Seeding failed:', err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

run()
