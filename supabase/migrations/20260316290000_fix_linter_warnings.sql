-- ============================================================
-- Migration: Fix all Supabase database linter warnings
--   WARN  : learner_journeys has two permissive SELECT policies
--           for `authenticated` → merge into one
--   INFO  : 34 unindexed FK columns  → replace partial indexes
--           (WHERE col IS NOT NULL) with full unrestricted indexes
--   INFO  : 8 unused indexes (idx_scan = 0) → drop them
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1: Fix WARN – merge duplicate permissive SELECT
--            policies on public.learner_journeys
-- ────────────────────────────────────────────────────────────

-- Drop both conflicting policies
DROP POLICY IF EXISTS "learner_journeys_admin_select" ON public.learner_journeys;
DROP POLICY IF EXISTS "learner_journeys_own_select"   ON public.learner_journeys;

-- Single merged policy: learner sees their own rows OR an admin
-- sees all rows that belong to their organisation.
CREATE POLICY "learner_journeys_select"
  ON public.learner_journeys
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR organization_id IN (
      SELECT organization_id
      FROM   public.organization_memberships
      WHERE  user_id = (SELECT auth.uid())
        AND  role IN ('admin', 'owner')
    )
  );


-- ────────────────────────────────────────────────────────────
-- SECTION 2: Drop 8 unused indexes (idx_scan = 0)
-- ────────────────────────────────────────────────────────────

-- From 20260316160000 (round 1) – never scanned
DROP INDEX IF EXISTS public.certificates_course_id_idx;
DROP INDEX IF EXISTS public.certificates_organization_id_idx;
DROP INDEX IF EXISTS public.course_assignments_assigned_by_idx;

-- From 20260316270000 (fix_log_errors) – never scanned
DROP INDEX IF EXISTS public.learner_journeys_user_id_idx;
DROP INDEX IF EXISTS public.learner_journeys_course_id_idx;
DROP INDEX IF EXISTS public.learner_journeys_organization_id_idx;
DROP INDEX IF EXISTS public.learner_journeys_updated_at_idx;

-- From 20260316270000 (fix_log_errors) – user_lesson_progress – never scanned
DROP INDEX IF EXISTS public.user_lesson_progress_organization_id_idx;


-- ────────────────────────────────────────────────────────────
-- SECTION 3: Replace partial FK indexes with full indexes
--
-- Supabase's unindexed-FK linter requires a full (non-partial)
-- index.  Round 2 (20260316170000) created all of these with
-- WHERE col IS NOT NULL which does NOT satisfy the linter.
--
-- Strategy: DROP each partial index, then CREATE a full one.
-- ────────────────────────────────────────────────────────────

-- course_engagement → organization_id
DROP INDEX IF EXISTS public.course_engagement_organization_id_idx;
CREATE INDEX IF NOT EXISTS course_engagement_organization_id_idx
  ON public.course_engagement(organization_id);

-- documents → user_id
DROP INDEX IF EXISTS public.documents_user_id_idx;
CREATE INDEX IF NOT EXISTS documents_user_id_idx
  ON public.documents(user_id);

-- email_logs → organization_id
DROP INDEX IF EXISTS public.email_logs_organization_id_idx;
CREATE INDEX IF NOT EXISTS email_logs_organization_id_idx
  ON public.email_logs(organization_id);

-- email_logs → sent_by  (partial was NOT created in round 2 – new)
CREATE INDEX IF NOT EXISTS email_logs_sent_by_idx
  ON public.email_logs(sent_by);

-- lessons → organization_id
DROP INDEX IF EXISTS public.lessons_organization_id_idx;
CREATE INDEX IF NOT EXISTS lessons_organization_id_idx
  ON public.lessons(organization_id);

-- message_logs → org_id
DROP INDEX IF EXISTS public.message_logs_org_id_idx;
CREATE INDEX IF NOT EXISTS message_logs_org_id_idx
  ON public.message_logs(org_id);

-- message_logs → organization_id
DROP INDEX IF EXISTS public.message_logs_organization_id_idx;
CREATE INDEX IF NOT EXISTS message_logs_organization_id_idx
  ON public.message_logs(organization_id);

-- message_logs → sent_by  (was never covered – new)
CREATE INDEX IF NOT EXISTS message_logs_sent_by_idx
  ON public.message_logs(sent_by);

-- modules → organization_id
DROP INDEX IF EXISTS public.modules_organization_id_idx;
CREATE INDEX IF NOT EXISTS modules_organization_id_idx
  ON public.modules(organization_id);

-- notifications → created_by  (dropped in round 1, not recreated – new)
CREATE INDEX IF NOT EXISTS notifications_created_by_idx
  ON public.notifications(created_by);

-- notifications → organization_id  (dropped in round 1, not recreated – new)
CREATE INDEX IF NOT EXISTS notifications_organization_id_idx
  ON public.notifications(organization_id);

-- org_activation_events → org_id
DROP INDEX IF EXISTS public.org_activation_events_org_id_idx;
CREATE INDEX IF NOT EXISTS org_activation_events_org_id_idx
  ON public.org_activation_events(org_id);

-- org_activation_events → actor_id  (dropped in round 1, not in round 2 – new)
CREATE INDEX IF NOT EXISTS org_activation_events_actor_id_idx
  ON public.org_activation_events(actor_id);

-- org_invites → invited_by
DROP INDEX IF EXISTS public.org_invites_invited_by_idx;
CREATE INDEX IF NOT EXISTS org_invites_invited_by_idx
  ON public.org_invites(invited_by);

-- org_invites → accepted_user_id  (dropped in round 1, not in round 2 – new)
CREATE INDEX IF NOT EXISTS org_invites_accepted_user_id_idx
  ON public.org_invites(accepted_user_id);

-- org_invites → created_by  (dropped in round 1, not in round 2 – new)
CREATE INDEX IF NOT EXISTS org_invites_created_by_idx
  ON public.org_invites(created_by);

-- org_workspace_action_items → org_id
DROP INDEX IF EXISTS public.org_workspace_action_items_org_id_idx;
CREATE INDEX IF NOT EXISTS org_workspace_action_items_org_id_idx
  ON public.org_workspace_action_items(org_id);

-- org_workspace_action_items → plan_id
DROP INDEX IF EXISTS public.org_workspace_action_items_plan_id_idx;
CREATE INDEX IF NOT EXISTS org_workspace_action_items_plan_id_idx
  ON public.org_workspace_action_items(plan_id);

-- org_workspace_action_items → assignee_id  (dropped in round 1, not in round 2 – new)
CREATE INDEX IF NOT EXISTS org_workspace_action_items_assignee_id_idx
  ON public.org_workspace_action_items(assignee_id);

-- org_workspace_action_items → created_by  (dropped in round 1, not in round 2 – new)
CREATE INDEX IF NOT EXISTS org_workspace_action_items_created_by_idx
  ON public.org_workspace_action_items(created_by);

-- org_workspace_session_notes → org_id
DROP INDEX IF EXISTS public.org_workspace_session_notes_org_id_idx;
CREATE INDEX IF NOT EXISTS org_workspace_session_notes_org_id_idx
  ON public.org_workspace_session_notes(org_id);

-- org_workspace_session_notes → author_id  (dropped in round 1, not in round 2 – new)
CREATE INDEX IF NOT EXISTS org_workspace_session_notes_author_id_idx
  ON public.org_workspace_session_notes(author_id);

-- org_workspace_session_notes → created_by  (dropped in round 1, not in round 2 – new)
CREATE INDEX IF NOT EXISTS org_workspace_session_notes_created_by_idx
  ON public.org_workspace_session_notes(created_by);

-- org_workspace_strategic_plans → org_id
DROP INDEX IF EXISTS public.org_workspace_strategic_plans_org_id_idx;
CREATE INDEX IF NOT EXISTS org_workspace_strategic_plans_org_id_idx
  ON public.org_workspace_strategic_plans(org_id);

-- org_workspace_strategic_plans → created_by  (dropped in round 1, not in round 2 – new)
CREATE INDEX IF NOT EXISTS org_workspace_strategic_plans_created_by_idx
  ON public.org_workspace_strategic_plans(created_by);

-- org_workspace_strategic_plans → owner_id  (dropped in round 1, not in round 2 – new)
CREATE INDEX IF NOT EXISTS org_workspace_strategic_plans_owner_id_idx
  ON public.org_workspace_strategic_plans(owner_id);

-- organization_memberships → invited_by  (dropped in round 1, not in round 2 – new)
CREATE INDEX IF NOT EXISTS organization_memberships_invited_by_idx
  ON public.organization_memberships(invited_by);

-- organization_messages → sent_by
DROP INDEX IF EXISTS public.organization_messages_sent_by_idx;
CREATE INDEX IF NOT EXISTS organization_messages_sent_by_idx
  ON public.organization_messages(sent_by);

-- survey_responses → assignment_id
DROP INDEX IF EXISTS public.survey_responses_assignment_id_idx;
CREATE INDEX IF NOT EXISTS survey_responses_assignment_id_idx
  ON public.survey_responses(assignment_id);

-- survey_responses → survey_id
DROP INDEX IF EXISTS public.survey_responses_survey_id_idx;
CREATE INDEX IF NOT EXISTS survey_responses_survey_id_idx
  ON public.survey_responses(survey_id);

-- survey_responses → user_id
DROP INDEX IF EXISTS public.survey_responses_user_id_idx;
CREATE INDEX IF NOT EXISTS survey_responses_user_id_idx
  ON public.survey_responses(user_id);

-- user_profiles → organization_id
DROP INDEX IF EXISTS public.user_profiles_organization_id_idx;
CREATE INDEX IF NOT EXISTS user_profiles_organization_id_idx
  ON public.user_profiles(organization_id);


-- ────────────────────────────────────────────────────────────
-- SECTION 4: Full FK covering indexes that were dropped in
--            round 1 and never re-created (not even partially)
-- ────────────────────────────────────────────────────────────

-- course_assignments → course_id
CREATE INDEX IF NOT EXISTS course_assignments_course_id_idx
  ON public.course_assignments(course_id);

-- course_assignments → organization_id
CREATE INDEX IF NOT EXISTS course_assignments_organization_id_idx
  ON public.course_assignments(organization_id);

-- course_assignments → user_id
CREATE INDEX IF NOT EXISTS course_assignments_user_id_idx
  ON public.course_assignments(user_id);

-- courses → created_by
CREATE INDEX IF NOT EXISTS courses_created_by_idx
  ON public.courses(created_by);
