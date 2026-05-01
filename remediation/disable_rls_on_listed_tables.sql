-- Remediation SQL for "RLS Enabled No Policy" findings
-- Generated: 2026-04-30
-- WARNING: Run these commands as a superuser or the database owner.
-- Two options are provided below:
-- 1) Disable RLS on the listed tables (fast, reverts to normal GRANT-based permissioning)
-- 2) (Commented) Create permissive policies that allow the "authenticated" role full access
--    — Use option 2 only if you want to keep RLS enabled but provide at least one policy.

-- ===== Option 1: Disable RLS for all affected tables =====

ALTER TABLE public."_backup_org_onboarding_progress_vw" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."_policy_backup" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."admin_users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."analytics_events" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."audit_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."auth_audit" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."certificates" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."course_assignments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."course_engagement" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."course_media_assets" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."documents" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."email_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."hdi_assessment_results" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."idempotency_keys" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."learner_journeys" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."lesson_reflections" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."lessons" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."message_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."modules" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."org_activation_events" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."org_activation_steps" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."org_engagement_metrics" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."org_invites" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."org_workspace_action_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."org_workspace_session_notes" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."org_workspace_strategic_plans" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."organization_branding" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."organization_contacts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."organization_members" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."organization_messages" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."organization_profiles" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."quiz_attempts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."rls_audit_log" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."survey_assignments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."survey_responses" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."team_huddle_comments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."team_huddle_post_reactions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."team_huddle_posts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."team_huddle_reactions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."team_huddle_reports" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_achievements" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_activity_log" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_gamification_profile" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_lesson_progress" DISABLE ROW LEVEL SECURITY;

-- ===== Option 2: Keep RLS enabled but add a permissive policy for authenticated users =====
-- (Uncomment and adapt as needed; template below creates a permissive policy allowing
--  the built-in `authenticated` role to SELECT/INSERT/UPDATE/DELETE rows.)

-- CREATE POLICY "allow_authenticated_all_on__backup_org_onboarding_progress_vw" ON public."_backup_org_onboarding_progress_vw"
--   FOR ALL
--   TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "allow_authenticated_all_on__policy_backup" ON public."_policy_backup"
--   FOR ALL
--   TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "allow_authenticated_all_on_admin_users" ON public."admin_users"
--   FOR ALL
--   TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "allow_authenticated_all_on_analytics_events" ON public."analytics_events"
--   FOR ALL
--   TO authenticated USING (true) WITH CHECK (true);
-- -- (Repeat the pattern above for the remaining tables if you prefer policies.)

-- ===== Notes =====
-- - Disabling RLS reverts to standard GRANT-based access control. Ensure any required GRANTs
--   are in place for application roles after disabling RLS.
-- - Adding permissive policies is quick but may be overly-broad. Prefer writing precise
--   policies that check ownership or organization membership (e.g., USING (org_id = current_setting('app.current_org')::uuid) or USING (auth.uid() = owner_id)).
-- - Test in a staging environment before applying to production.
-- - To apply this file with psql:
--   psql "postgresql://<user>@<host>:<port>/<dbname>" -f /path/to/disable_rls_on_listed_tables.sql
-- - Or use your platform's tooling (Supabase Dashboard SQL editor, migrations, etc.).
