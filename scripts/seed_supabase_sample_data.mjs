#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('Please set DATABASE_URL or SUPABASE_DB_URL with your Supabase Postgres connection string.');
  process.exit(1);
}

const client = new Client({ connectionString });
const tableColumnsCache = new Map();

const SAMPLE_IDS = Object.freeze({
  organizations: {
    atlas: '11111111-1111-4111-8111-111111111111',
    lumen: '22222222-2222-4222-8222-222222222222',
  },
  courses: {
    foundations: '33333333-3333-4333-8333-333333333333',
    safety: '44444444-4444-4444-8444-444444444444',
  },
  modules: {
    awareness: '55555555-1111-4111-8111-555555555551',
    habits: '55555555-2222-4222-8222-555555555552',
    diagnostics: '55555555-3333-4333-8333-555555555553',
    coaching: '55555555-4444-4444-8444-555555555554',
  },
  lessons: {
    awarenessStory: '66661111-1111-4111-8111-666611111111',
    awarenessSignals: '66662222-2222-4222-8222-666622222222',
    awarenessRetro: '66663333-3333-4333-8333-666633333333',
    habitsModel: '66664444-4444-4444-8444-666644444444',
    habitsCadence: '66665555-5555-4555-8555-666655555555',
    habitsReflection: '66666666-6666-4666-8666-666666666666',
    diagnosticsSafety: '66667777-7777-4777-8777-666677777777',
    diagnosticsMeeting: '66668888-8888-4888-8888-666688888888',
    diagnosticsPulse: '66669999-9999-4999-8999-666699999999',
    coachingScripts: '6666aaaa-aaaa-4aaa-8aaa-6666aaaaaaaa',
    coachingLoops: '6666bbbb-bbbb-4bbb-8bbb-6666bbbbbbbb',
    coachingCelebrate: '6666cccc-cccc-4ccc-8ccc-6666cccccccc',
  },
  assignments: {
    alexFoundations: '77771111-1111-4111-8111-777711111111',
    jordanFoundations: '77772222-2222-4222-8222-777722222222',
    mayaSafety: '77773333-3333-4333-8333-777733333333',
  },
  memberships: {
    atlasAlex: '88881111-1111-4111-8111-888811111111',
    atlasJordan: '88882222-2222-4222-8222-888822222222',
    lumenMaya: '88883333-3333-4333-8333-888833333333',
  },
  courseProgress: {
    alexFoundations: '99991111-1111-4111-8111-999911111111',
    jordanFoundations: '99992222-2222-4222-8222-999922222222',
    mayaSafety: '99993333-3333-4333-8333-999933333333',
  },
  lessonProgress: {
    alexStory: 'aaaa1111-1111-4111-8111-aaaa11111111',
    alexSignals: 'aaaa2222-2222-4222-8222-aaaa22222222',
    jordanModel: 'aaaa3333-3333-4333-8333-aaaa33333333',
    mayaSafety: 'aaaa4444-4444-4444-8444-aaaa44444444',
    mayaLoops: 'aaaa5555-5555-4555-8555-aaaa55555555',
  },
  surveyResponses: {
    safetyPulse: 'bbbb1111-1111-4111-8111-bbbb11111111',
    inclusiveCoaching: 'bbbb2222-2222-4222-8222-bbbb22222222',
    inclusionWins: 'bbbb3333-3333-4333-8333-bbbb33333333',
  },
});

const sampleUsers = Object.freeze({
  alex: '8a0c0f4a-5d5f-4fdc-90de-6c6a5f7e8101',
  jordan: '0f645d16-4b70-4e5b-b1ad-2ba0a8a58a02',
  maya: 'bb41f30e-d61a-4d07-9f74-668a53ce0af3',
});

const iso = (value) => new Date(value).toISOString();

const sampleOrganizations = [
  {
    id: SAMPLE_IDS.organizations.atlas,
    name: 'Atlas Health Labs',
    type: 'health-tech',
    description: 'Scaling care navigation platform coaching 200+ leaders.',
    contact_person: 'Nora Hendrix',
    contact_email: 'ops@atlaslabs.health',
    subscription: 'enterprise',
    status: 'active',
  tags: ['healthcare', 'hybrid', 'wave-3'],
  features: { pulses: true, cohorts: true, insights: 'weekly' },
  settings: { timezone: 'America/Los_Angeles', locale: 'en-US' },
    total_learners: 215,
    active_learners: 162,
    completion_rate: 78.4,
  cohorts: ['Executive', 'Emerging Leaders'],
    last_activity: iso('2025-01-04T15:00:00Z'),
    enrollment_date: iso('2023-11-01T08:00:00Z'),
    contract_start: iso('2024-01-01T08:00:00Z'),
    contract_end: iso('2025-12-31T08:00:00Z'),
  },
  {
    id: SAMPLE_IDS.organizations.lumen,
    name: 'Lumen Workforce Collective',
    type: 'professional-services',
    description: 'People-operations cooperative supporting distributed teams.',
    contact_person: 'Ibrahim Solano',
    contact_email: 'hello@lumenwork.co',
    subscription: 'growth',
    status: 'active',
  tags: ['distributed', 'cooperative'],
  features: { nudges: true, office_hours: true },
  settings: { timezone: 'America/New_York', locale: 'en-US' },
    total_learners: 58,
    active_learners: 41,
    completion_rate: 64.1,
  cohorts: ['People Partners'],
    last_activity: iso('2025-01-09T09:15:00Z'),
    enrollment_date: iso('2024-03-12T08:00:00Z'),
    contract_start: iso('2024-04-01T08:00:00Z'),
    contract_end: iso('2025-06-30T08:00:00Z'),
  },
];

const sampleMemberships = [
  {
    id: SAMPLE_IDS.memberships.atlasAlex,
    org_id: SAMPLE_IDS.organizations.atlas,
    user_id: sampleUsers.alex,
    role: 'owner',
  },
  {
    id: SAMPLE_IDS.memberships.atlasJordan,
    org_id: SAMPLE_IDS.organizations.atlas,
    user_id: sampleUsers.jordan,
    role: 'manager',
  },
  {
    id: SAMPLE_IDS.memberships.lumenMaya,
    org_id: SAMPLE_IDS.organizations.lumen,
    user_id: sampleUsers.maya,
    role: 'admin',
  },
];

const sampleCourses = [
  {
    id: SAMPLE_IDS.courses.foundations,
    organization_id: SAMPLE_IDS.organizations.atlas,
    slug: 'foundations-of-inclusive-leadership',
    title: 'Foundations of Inclusive Leadership',
    description: 'Practice-ready curriculum that makes psychological safety measurable.',
    status: 'published',
    version: 3,
    meta_json: {
      difficulty: 'Intermediate',
      estimated_minutes: 95,
      tags: ['leadership', 'psychological-safety'],
      thumbnail: 'https://images.pexels.com/photos/3184396/pexels-photo-3184396.jpeg?auto=compress&cs=tinysrgb&w=1200',
    },
    published_at: iso('2024-08-15T15:00:00Z'),
    due_date: iso('2025-02-01T15:00:00Z'),
  },
  {
    id: SAMPLE_IDS.courses.safety,
    organization_id: SAMPLE_IDS.organizations.lumen,
    slug: 'psychological-safety-accelerator',
    title: 'Psychological Safety Accelerator',
    description: 'Four-week sprint that helps teams codify safer rituals and retros.',
    status: 'published',
    version: 2,
    meta_json: {
      difficulty: 'Advanced',
      estimated_minutes: 80,
      tags: ['team-health', 'rituals'],
      thumbnail: 'https://images.pexels.com/photos/1181355/pexels-photo-1181355.jpeg?auto=compress&cs=tinysrgb&w=1200',
    },
    published_at: iso('2024-10-01T12:00:00Z'),
    due_date: iso('2025-01-20T12:00:00Z'),
  },
];

const sampleModules = [
  {
    id: SAMPLE_IDS.modules.awareness,
    course_id: SAMPLE_IDS.courses.foundations,
    order_index: 0,
    title: 'Awareness & Mindset',
    description: 'Clarify the language and signals of inclusive leadership.',
  },
  {
    id: SAMPLE_IDS.modules.habits,
    course_id: SAMPLE_IDS.courses.foundations,
    order_index: 1,
    title: 'Habits in Practice',
    description: 'Translate commitments into observable team routines.',
  },
  {
    id: SAMPLE_IDS.modules.diagnostics,
    course_id: SAMPLE_IDS.courses.safety,
    order_index: 0,
    title: 'Diagnostics Sprint',
    description: 'Surface leading indicators of psychological safety.',
  },
  {
    id: SAMPLE_IDS.modules.coaching,
    course_id: SAMPLE_IDS.courses.safety,
    order_index: 1,
    title: 'Coaching & Sustainment',
    description: 'Codify rituals and a coaching cadence that sticks.',
  },
];

const sampleLessons = [
  {
    id: SAMPLE_IDS.lessons.awarenessStory,
    module_id: SAMPLE_IDS.modules.awareness,
    order_index: 0,
    type: 'video',
    title: 'Leadership Story: Psychological Safety Wins',
    description: 'Video vignette that models inclusive decision-making.',
    duration_s: 480,
    content_json: {
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      transcript: 'Leaders narrate the behaviors that elevated trust inside Atlas Health Labs...',
      keyMoments: ['Invite dissent early', 'Share intent before feedback'],
    },
    completion_rule_json: { type: 'watch', percent: 0.9 },
  },
  {
    id: SAMPLE_IDS.lessons.awarenessSignals,
    module_id: SAMPLE_IDS.modules.awareness,
    order_index: 1,
    type: 'quiz',
    title: 'Spot the Signals',
    description: 'Interactive scenario quiz to identify psychological safety red flags.',
    duration_s: 420,
    content_json: {
      title: 'Signal scanner',
      questions: 5,
      scoring: 'immediate-feedback',
    },
  },
  {
    id: SAMPLE_IDS.lessons.awarenessRetro,
    module_id: SAMPLE_IDS.modules.awareness,
    order_index: 2,
    type: 'worksheet',
    title: 'Micro-retro template',
    description: 'Downloadable prompts to run 10-minute micro retros.',
    duration_s: 300,
    content_json: {
      docUrl: 'https://the-huddle.co/resources/micro-retro.pdf',
      prompts: ['What energized you?', 'Where did we hesitate?'],
    },
  },
  {
    id: SAMPLE_IDS.lessons.habitsModel,
    module_id: SAMPLE_IDS.modules.habits,
    order_index: 0,
    type: 'text',
    title: 'Habit Scaffold',
    description: 'A lightweight model to evaluate inclusion habits.',
    duration_s: 360,
    content_json: {
      sections: [
        { heading: 'Signal -> Practice', body: 'Translate qualitative signals into a recurring practice.' },
      ],
    },
  },
  {
    id: SAMPLE_IDS.lessons.habitsCadence,
    module_id: SAMPLE_IDS.modules.habits,
    order_index: 1,
    type: 'audio',
    title: 'Cadence Coach Note',
    description: '5-minute coaching memo on rhythm-building.',
    duration_s: 300,
    content_json: {
      audioUrl: 'https://actions.google.com/sounds/v1/ambiences/offices.ogg',
      takeaways: ['Pair rituals with triggers', 'Archive new commitments'],
    },
  },
  {
    id: SAMPLE_IDS.lessons.habitsReflection,
    module_id: SAMPLE_IDS.modules.habits,
    order_index: 2,
    type: 'reflection',
    title: 'Inclusive Week-in-review',
    description: 'Journaling prompts that reinforce repetition.',
    duration_s: 420,
    content_json: {
      prompts: ['Where did you amplify quieter perspectives?', 'What friction can you remove next week?'],
    },
  },
  {
    id: SAMPLE_IDS.lessons.diagnosticsSafety,
    module_id: SAMPLE_IDS.modules.diagnostics,
    order_index: 0,
    type: 'video',
    title: 'Psychological Safety Diagnostics',
    description: 'Coach walkthrough of leading indicators.',
    duration_s: 540,
    content_json: {
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      worksheet: 'https://the-huddle.co/resources/safety-checklist.pdf',
    },
  },
  {
    id: SAMPLE_IDS.lessons.diagnosticsMeeting,
    module_id: SAMPLE_IDS.modules.diagnostics,
    order_index: 1,
    type: 'exercise',
    title: 'Meeting Ritual Assessment',
    description: 'Score the next team meeting against inclusive guardrails.',
    duration_s: 420,
    content_json: {
      rubric: ['Invite', 'Equal airtime', 'Action clarity'],
    },
  },
  {
    id: SAMPLE_IDS.lessons.diagnosticsPulse,
    module_id: SAMPLE_IDS.modules.diagnostics,
    order_index: 2,
    type: 'survey',
    title: 'Safety Pulse Draft',
    description: 'Editable mini-pulse to test with your team.',
    duration_s: 240,
    content_json: {
      questions: ['I can ask a question without prepping a script.'],
    },
  },
  {
    id: SAMPLE_IDS.lessons.coachingScripts,
    module_id: SAMPLE_IDS.modules.coaching,
    order_index: 0,
    type: 'text',
    title: 'Coaching Scripts',
    description: 'Conversation starters for accountability chats.',
    duration_s: 360,
    content_json: {
      scripts: ['"What felt uneven?"', '"Where do we need a pause?"'],
    },
  },
  {
    id: SAMPLE_IDS.lessons.coachingLoops,
    module_id: SAMPLE_IDS.modules.coaching,
    order_index: 1,
    type: 'quiz',
    title: 'Coaching Loop Builder',
    description: 'Branching scenario that teaches follow-up cadence.',
    duration_s: 420,
    content_json: {
      branches: 3,
      feedback: 'instant',
    },
  },
  {
    id: SAMPLE_IDS.lessons.coachingCelebrate,
    module_id: SAMPLE_IDS.modules.coaching,
    order_index: 2,
    type: 'resource',
    title: 'Celebrate & Sustain',
    description: 'Checklist to recognize inclusive behavior on repeat.',
    duration_s: 210,
    content_json: {
      checklist: ['Call out specific behaviors', 'Tie recognition to values'],
    },
  },
];

const sampleAssignments = [
  {
    id: SAMPLE_IDS.assignments.alexFoundations,
    organization_id: SAMPLE_IDS.organizations.atlas,
    org_id: SAMPLE_IDS.organizations.atlas,
    course_id: SAMPLE_IDS.courses.foundations,
    user_id: sampleUsers.alex,
    status: 'in_progress',
    active: true,
    due_at: iso('2025-01-20T17:00:00Z'),
    grade: 92.5,
  },
  {
    id: SAMPLE_IDS.assignments.jordanFoundations,
    organization_id: SAMPLE_IDS.organizations.atlas,
    org_id: SAMPLE_IDS.organizations.atlas,
    course_id: SAMPLE_IDS.courses.foundations,
    user_id: sampleUsers.jordan,
    status: 'assigned',
    active: true,
    due_at: iso('2025-02-10T17:00:00Z'),
  },
  {
    id: SAMPLE_IDS.assignments.mayaSafety,
    organization_id: SAMPLE_IDS.organizations.lumen,
    org_id: SAMPLE_IDS.organizations.lumen,
    course_id: SAMPLE_IDS.courses.safety,
    user_id: sampleUsers.maya,
    status: 'completed',
    active: true,
    submitted_at: iso('2025-01-05T17:00:00Z'),
    grade: 88.75,
  },
];

const sampleCourseProgress = [
  {
    id: SAMPLE_IDS.courseProgress.alexFoundations,
    user_id: sampleUsers.alex,
    course_id: SAMPLE_IDS.courses.foundations,
    org_id: SAMPLE_IDS.organizations.atlas,
    organization_id: SAMPLE_IDS.organizations.atlas,
    percent: 82.5,
    progress: 82.5,
    status: 'in_progress',
    completed: false,
    time_spent_s: 3600,
    time_spent_seconds: 3600,
    updated_at: iso('2025-01-09T08:00:00Z'),
  },
  {
    id: SAMPLE_IDS.courseProgress.jordanFoundations,
    user_id: sampleUsers.jordan,
    course_id: SAMPLE_IDS.courses.foundations,
    org_id: SAMPLE_IDS.organizations.atlas,
    organization_id: SAMPLE_IDS.organizations.atlas,
    percent: 24.0,
    progress: 24.0,
    status: 'not_started',
    completed: false,
    time_spent_s: 900,
    time_spent_seconds: 900,
    updated_at: iso('2025-01-06T14:00:00Z'),
  },
  {
    id: SAMPLE_IDS.courseProgress.mayaSafety,
    user_id: sampleUsers.maya,
    course_id: SAMPLE_IDS.courses.safety,
    org_id: SAMPLE_IDS.organizations.lumen,
    organization_id: SAMPLE_IDS.organizations.lumen,
    percent: 100,
    progress: 100,
    status: 'completed',
    completed: true,
    time_spent_s: 2700,
    time_spent_seconds: 2700,
    updated_at: iso('2025-01-07T18:00:00Z'),
  },
];

const sampleLessonProgress = [
  {
    id: SAMPLE_IDS.lessonProgress.alexStory,
    user_id: sampleUsers.alex,
    lesson_id: SAMPLE_IDS.lessons.awarenessStory,
    course_id: SAMPLE_IDS.courses.foundations,
    org_id: SAMPLE_IDS.organizations.atlas,
    organization_id: SAMPLE_IDS.organizations.atlas,
    percent: 100,
    progress: 100,
    status: 'completed',
    completed: true,
    time_spent_s: 520,
    time_spent_seconds: 520,
  },
  {
    id: SAMPLE_IDS.lessonProgress.alexSignals,
    user_id: sampleUsers.alex,
    lesson_id: SAMPLE_IDS.lessons.awarenessSignals,
    course_id: SAMPLE_IDS.courses.foundations,
    org_id: SAMPLE_IDS.organizations.atlas,
    organization_id: SAMPLE_IDS.organizations.atlas,
    percent: 76,
    progress: 76,
    status: 'in_progress',
    completed: false,
    time_spent_s: 410,
    time_spent_seconds: 410,
  },
  {
    id: SAMPLE_IDS.lessonProgress.jordanModel,
    user_id: sampleUsers.jordan,
    lesson_id: SAMPLE_IDS.lessons.habitsModel,
    course_id: SAMPLE_IDS.courses.foundations,
    org_id: SAMPLE_IDS.organizations.atlas,
    organization_id: SAMPLE_IDS.organizations.atlas,
    percent: 25,
    progress: 25,
    status: 'not_started',
    completed: false,
    time_spent_s: 120,
    time_spent_seconds: 120,
  },
  {
    id: SAMPLE_IDS.lessonProgress.mayaSafety,
    user_id: sampleUsers.maya,
    lesson_id: SAMPLE_IDS.lessons.diagnosticsSafety,
    course_id: SAMPLE_IDS.courses.safety,
    org_id: SAMPLE_IDS.organizations.lumen,
    organization_id: SAMPLE_IDS.organizations.lumen,
    percent: 100,
    progress: 100,
    status: 'completed',
    completed: true,
    time_spent_s: 540,
    time_spent_seconds: 540,
  },
  {
    id: SAMPLE_IDS.lessonProgress.mayaLoops,
    user_id: sampleUsers.maya,
    lesson_id: SAMPLE_IDS.lessons.coachingLoops,
    course_id: SAMPLE_IDS.courses.safety,
    org_id: SAMPLE_IDS.organizations.lumen,
    organization_id: SAMPLE_IDS.organizations.lumen,
    percent: 88,
    progress: 88,
    status: 'in_progress',
    completed: false,
    time_spent_s: 360,
    time_spent_seconds: 360,
  },
];

const sampleSurveyResponses = [
  {
    id: SAMPLE_IDS.surveyResponses.safetyPulse,
    user_id: sampleUsers.maya,
    org_id: SAMPLE_IDS.organizations.lumen,
    organization_id: SAMPLE_IDS.organizations.lumen,
    course_id: SAMPLE_IDS.courses.safety,
    question_id: 'pulse_ps_belonging',
    response_text: 'Quick victories: opened retro with intent check-in.',
    rating: 5,
  },
  {
    id: SAMPLE_IDS.surveyResponses.inclusiveCoaching,
    user_id: sampleUsers.alex,
    org_id: SAMPLE_IDS.organizations.atlas,
    organization_id: SAMPLE_IDS.organizations.atlas,
    course_id: SAMPLE_IDS.courses.foundations,
    question_id: 'coach_confidence',
    response_text: 'Cadence builder gave my staff meeting a simple shape.',
    rating: 4,
  },
  {
    id: SAMPLE_IDS.surveyResponses.inclusionWins,
    user_id: sampleUsers.jordan,
    org_id: SAMPLE_IDS.organizations.atlas,
    organization_id: SAMPLE_IDS.organizations.atlas,
    course_id: SAMPLE_IDS.courses.foundations,
    question_id: 'inclusion_wins',
    response_text: 'Paired decision memos with a "gut-check" minute.',
    rating: 3,
  },
];

const tablesToSeed = [
  ['organizations', sampleOrganizations],
  ['organization_memberships', sampleMemberships],
  ['courses', sampleCourses],
  ['modules', sampleModules],
  ['lessons', sampleLessons],
  ['assignments', sampleAssignments],
  ['user_course_progress', sampleCourseProgress],
  ['user_lesson_progress', sampleLessonProgress],
  ['survey_responses', sampleSurveyResponses],
];

async function loadTableColumns(table) {
  if (tableColumnsCache.has(table)) {
    return tableColumnsCache.get(table);
  }

  const { rows } = await client.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
    [table]
  );

  if (!rows.length) {
    console.warn(`⚠️  Table ${table} is missing in this database. Skipping.`);
    tableColumnsCache.set(table, null);
    return null;
  }

  const columns = new Set(rows.map((row) => row.column_name));
  tableColumnsCache.set(table, columns);
  return columns;
}

async function upsertRows(table, rows) {
  if (!rows.length) {
    return 0;
  }

  const columns = await loadTableColumns(table);
  if (!columns || !columns.size) {
    return 0;
  }

  let processed = 0;
  for (const row of rows) {
    const entries = Object.entries(row).filter(([column]) => columns.has(column));
    if (!entries.length) {
      continue;
    }

    const colNames = entries.map(([column]) => column);
    const values = entries.map(([, value]) => value);
    const placeholders = colNames.map((_, index) => `$${index + 1}`);
    const updateAssignments = colNames
      .filter((column) => column !== 'id')
      .map((column) => `${column} = EXCLUDED.${column}`);

    const updateClause = updateAssignments.length ? `DO UPDATE SET ${updateAssignments.join(', ')}` : 'DO NOTHING';

    const statement = `
      INSERT INTO public.${table} (${colNames.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (id) ${updateClause};
    `;

    await client.query(statement, values);
    processed += 1;
  }

  return processed;
}

async function main() {
  console.log('🌱 Seeding Supabase LMS sample dataset...');
  await client.connect();

  try {
    await client.query('BEGIN');
    for (const [table, rows] of tablesToSeed) {
      const count = await upsertRows(table, rows);
      console.log(` • ${table}: ${count} row(s) processed`);
    }
    await client.query('COMMIT');
    console.log('\n✅ Seed complete. Re-run anytime to refresh these canonical fixtures.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
