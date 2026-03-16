-- Migration: fix all production log errors
-- 1. Add organization_id to user_lesson_progress (was queried but missing)
-- 2. Create learner_journeys table (was missing, causing graceful-degraded 200s)

-- ─── 1. user_lesson_progress: add organization_id ───────────────────────────
ALTER TABLE user_lesson_progress
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_lesson_progress_organization_id_idx
  ON user_lesson_progress(organization_id);

-- ─── 2. Create learner_journeys table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learner_journeys (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id           text NOT NULL,
  organization_id     uuid REFERENCES organizations(id) ON DELETE SET NULL,
  started_at          timestamptz NOT NULL DEFAULT now(),
  last_active_at      timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  total_time_spent    integer NOT NULL DEFAULT 0,
  sessions_count      integer NOT NULL DEFAULT 0,
  progress_percentage numeric(5,2) NOT NULL DEFAULT 0,
  engagement_score    numeric(5,2) NOT NULL DEFAULT 0,
  milestones          jsonb NOT NULL DEFAULT '[]'::jsonb,
  drop_off_points     jsonb NOT NULL DEFAULT '[]'::jsonb,
  path_taken          jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE learner_journeys ENABLE ROW LEVEL SECURITY;

-- Learner can read and write their own journey
CREATE POLICY "learner_journeys_own_select"
  ON learner_journeys FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "learner_journeys_own_insert"
  ON learner_journeys FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "learner_journeys_own_update"
  ON learner_journeys FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Admin can read all journeys in their org
CREATE POLICY "learner_journeys_admin_select"
  ON learner_journeys FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = (select auth.uid()) AND role IN ('admin','owner')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS learner_journeys_user_id_idx       ON learner_journeys(user_id);
CREATE INDEX IF NOT EXISTS learner_journeys_course_id_idx     ON learner_journeys(course_id);
CREATE INDEX IF NOT EXISTS learner_journeys_organization_id_idx ON learner_journeys(organization_id);
CREATE INDEX IF NOT EXISTS learner_journeys_updated_at_idx    ON learner_journeys(updated_at DESC);
