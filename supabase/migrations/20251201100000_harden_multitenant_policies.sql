-- Harden multi-tenant RLS policies, add analytics persistence, and expose survey summaries
BEGIN;

-- Ensure organization columns exist for hierarchical LMS tables
ALTER TABLE courses ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Backfill organization references based on parent relationships
UPDATE modules SET organization_id = courses.organization_id
FROM courses
WHERE modules.course_id = courses.id AND modules.organization_id IS NULL;

UPDATE lessons SET organization_id = modules.organization_id
FROM modules
WHERE lessons.module_id = modules.id AND lessons.organization_id IS NULL;

-- Replace permissive course policies with tenant-aware rules
DROP POLICY IF EXISTS "Anonymous users can read published courses" ON courses;
DROP POLICY IF EXISTS "Authenticated users can read all courses" ON courses;
DROP POLICY IF EXISTS "Authenticated users can insert courses" ON courses;
DROP POLICY IF EXISTS "Authenticated users can update courses" ON courses;
DROP POLICY IF EXISTS "Authenticated users can delete courses" ON courses;
DROP POLICY IF EXISTS "Authenticated users can manage courses" ON courses;
DROP POLICY IF EXISTS "Service role has full access" ON courses;

CREATE POLICY tenant_courses_select
  ON courses
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt()->>'role' = 'SUPER_ADMIN'
    OR organization_id IS NULL
    OR (auth.jwt()->>'organization_id')::uuid = organization_id
  );

CREATE POLICY tenant_courses_manage
  ON courses
  FOR ALL
  TO authenticated
  USING (
    auth.jwt()->>'role' IN ('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
    AND (
      organization_id IS NULL
      OR (auth.jwt()->>'organization_id')::uuid = organization_id
    )
  )
  WITH CHECK (
    organization_id IS NULL
    OR (auth.jwt()->>'organization_id')::uuid = organization_id
  );

-- Modules & lessons inherit the same tenant guardrails
DROP POLICY IF EXISTS tenant_select_modules ON modules;
DROP POLICY IF EXISTS tenant_write_modules ON modules;
CREATE POLICY tenant_modules_access
  ON modules
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->>'role') = 'SUPER_ADMIN'
    OR (
      modules.organization_id IS NOT NULL
      AND (auth.jwt()->>'organization_id')::uuid = modules.organization_id
    )
  )
  WITH CHECK (
    modules.organization_id IS NULL
    OR (auth.jwt()->>'organization_id')::uuid = modules.organization_id
  );

DROP POLICY IF EXISTS tenant_select_lessons ON lessons;
DROP POLICY IF EXISTS tenant_write_lessons ON lessons;
CREATE POLICY tenant_lessons_access
  ON lessons
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->>'role') = 'SUPER_ADMIN'
    OR (
      lessons.organization_id IS NOT NULL
      AND (auth.jwt()->>'organization_id')::uuid = lessons.organization_id
    )
  )
  WITH CHECK (
    lessons.organization_id IS NULL
    OR (auth.jwt()->>'organization_id')::uuid = lessons.organization_id
  );

-- Harden survey assignment storage
ALTER TABLE survey_assignments
  ALTER COLUMN organization_ids TYPE uuid[]
  USING COALESCE(
    ARRAY(
      SELECT value::uuid
      FROM unnest(organization_ids) AS value
      WHERE value IS NOT NULL AND value <> ''
    ),
    ARRAY[]::uuid[]
  );
ALTER TABLE survey_assignments
  ALTER COLUMN organization_ids SET NOT NULL;
ALTER TABLE survey_assignments
  ALTER COLUMN organization_ids SET DEFAULT ARRAY[]::uuid[];
ALTER TABLE survey_assignments
  ADD CONSTRAINT IF NOT EXISTS survey_assignments_org_not_empty
  CHECK (array_length(organization_ids, 1) > 0);
ALTER TABLE survey_assignments
  ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

DROP POLICY IF EXISTS survey_assignments_select ON survey_assignments;
DROP POLICY IF EXISTS survey_assignments_manage ON survey_assignments;

CREATE POLICY survey_assignments_select
  ON survey_assignments
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt()->>'role' = 'SUPER_ADMIN'
    OR (auth.jwt()->>'organization_id')::uuid = ANY(organization_ids)
  );

CREATE POLICY survey_assignments_manage
  ON survey_assignments
  FOR ALL
  TO authenticated
  USING (
    auth.jwt()->>'role' IN ('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
    AND (auth.jwt()->>'organization_id')::uuid = ANY(organization_ids)
  )
  WITH CHECK (
    auth.jwt()->>'role' IN ('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
    AND organization_ids <@ ARRAY[(auth.jwt()->>'organization_id')::uuid]
  );

-- Notifications table upgrades for cross-device sync
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_user_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal';
ALTER TABLE notifications ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications (recipient_user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications (read_at);

-- Analytics persistence table
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  organization_id uuid,
  user_id text,
  course_id text,
  lesson_id text,
  module_id text,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  user_agent text,
  session_id text,
  occurred_at timestamptz DEFAULT timezone('utc', now())
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_events_select ON analytics_events;
DROP POLICY IF EXISTS analytics_events_write ON analytics_events;

CREATE POLICY analytics_events_select
  ON analytics_events
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt()->>'role' = 'SUPER_ADMIN'
    OR organization_id IS NULL
    OR (auth.jwt()->>'organization_id')::uuid = organization_id
  );

CREATE POLICY analytics_events_write
  ON analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR (auth.jwt()->>'organization_id')::uuid = organization_id
  );

-- Survey response storage for analytics summaries
CREATE TABLE IF NOT EXISTS survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id text NOT NULL,
  organization_id uuid,
  responder_id text,
  submitted_at timestamptz DEFAULT timezone('utc', now()),
  completion_seconds integer,
  aggregate jsonb DEFAULT '{}'::jsonb,
  answers jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS survey_responses_select ON survey_responses;
DROP POLICY IF EXISTS survey_responses_write ON survey_responses;

CREATE POLICY survey_responses_select
  ON survey_responses
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt()->>'role' = 'SUPER_ADMIN'
    OR organization_id IS NULL
    OR (auth.jwt()->>'organization_id')::uuid = organization_id
  );

CREATE POLICY survey_responses_write
  ON survey_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR (auth.jwt()->>'organization_id')::uuid = organization_id
  );

CREATE INDEX IF NOT EXISTS survey_responses_survey_idx ON survey_responses (survey_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_course_idx ON analytics_events (course_id, occurred_at DESC);

-- RPC to fetch aggregated survey analytics
CREATE OR REPLACE FUNCTION fetch_survey_summary(survey_identifier text, target_org uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  summary jsonb;
BEGIN
  WITH filtered AS (
    SELECT *
    FROM survey_responses
    WHERE survey_id = survey_identifier
      AND (target_org IS NULL OR organization_id = target_org)
  ),
  question_stats AS (
    SELECT question_id, ROUND(AVG(score), 2) AS avg_score
    FROM (
      SELECT (answer->>'id') AS question_id, (answer->>'score')::numeric AS score
      FROM filtered,
        LATERAL jsonb_array_elements(COALESCE(answers, '[]'::jsonb)) AS answer
      WHERE answer ? 'score'
    ) q
    GROUP BY question_id
  ),
  insight_values AS (
    SELECT DISTINCT value
    FROM (
      SELECT jsonb_array_elements_text(COALESCE(aggregate->'insights', '[]'::jsonb)) AS value
      FROM filtered
    ) raw
    WHERE value IS NOT NULL AND value <> ''
  )
  SELECT jsonb_build_object(
    'surveyId', survey_identifier,
    'title', COALESCE((SELECT title FROM surveys WHERE id::text = survey_identifier), 'Survey'),
    'totalResponses', (SELECT COUNT(*) FROM filtered),
    'completionRate', COALESCE((SELECT ROUND(AVG((aggregate->>'completion_rate')::numeric), 2) FROM filtered WHERE aggregate ? 'completion_rate'), 0),
    'avgCompletionTime', COALESCE((SELECT ROUND(AVG(completion_seconds)::numeric, 2) FROM filtered WHERE completion_seconds IS NOT NULL), 0),
    'questionSummaries', COALESCE((SELECT jsonb_agg(jsonb_build_object('questionId', question_id, 'avgScore', avg_score)) FROM question_stats), '[]'::jsonb),
    'insights', COALESCE((SELECT jsonb_agg(value) FROM insight_values), '[]'::jsonb)
  )
  INTO summary;

  RETURN COALESCE(summary, jsonb_build_object(
    'surveyId', survey_identifier,
    'title', COALESCE((SELECT title FROM surveys WHERE id::text = survey_identifier), 'Survey'),
    'totalResponses', 0,
    'completionRate', 0,
    'avgCompletionTime', 0,
    'questionSummaries', '[]'::jsonb,
    'insights', '[]'::jsonb
  ));
END;
$$;

COMMIT;
