-- Migration: drop a set of unused indexes reported by the Supabase linter
-- Date: 2026-04-13
-- WARNING: Review each DROP before running in production. Take a backup/snapshot first.
-- This file issues DROP INDEX CONCURRENTLY statements (no transaction).
-- If you want to recreate any index later, run the helper script `scripts/collect_unused_index_defs.sql`
-- against your database to obtain the exact CREATE INDEX definitions.

-- IMPORTANT: run this using psql (not inside a transaction), e.g.:
--   psql "$DATABASE_URL" -f migrations/2026-04-13_drop_unused_indexes.sql

-- Example safe single-statement run (interactive):
--   psql "$DATABASE_URL"
--   DROP INDEX CONCURRENTLY IF EXISTS public.assignments_user_id_idx;

-- --- DROP INDEXes (review before executing) ---
DROP INDEX CONCURRENTLY IF EXISTS public.assignments_user_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.assignments_updated_at_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.survey_responses_assessment_type_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.surveys_assessment_type_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.organization_memberships_user_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_course_engagement_course;
DROP INDEX CONCURRENTLY IF EXISTS public.hdi_assessment_results_survey_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.hdi_assessment_results_user_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.hdi_assessment_results_org_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_invites_token_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.surveys_org_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.assignments_user_id_uuid_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_invites_org_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.lesson_reflections_response_data_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.lesson_reflections_org_course_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.lesson_reflections_user_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.lesson_reflections_org_course_lesson_user_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.lesson_reflections_org_course_module_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_org_activation_steps_org_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_documents_created_by;
DROP INDEX CONCURRENTLY IF EXISTS public.course_engagement_organization_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.documents_user_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.analytics_events_org_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_courses_org;
DROP INDEX CONCURRENTLY IF EXISTS public.email_logs_organization_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.email_logs_sent_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.lessons_organization_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_activation_steps_org_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_lessons_module;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_lessons_course;
DROP INDEX CONCURRENTLY IF EXISTS public.analytics_events_user_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.message_logs_sent_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.modules_organization_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.notifications_created_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_workspace_action_items_org_workspace_action_items_org_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_workspace_action_items_plan_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_workspace_action_items_assignee_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_workspace_action_items_created_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_workspace_session_notes_org_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_workspace_session_notes_author_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_workspace_session_notes_created_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_activation_events_org_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_activation_events_actor_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_invites_invited_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_invites_accepted_user_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_invites_created_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_workspace_strategic_plans_org_workspace_strategic_plans_org_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_workspace_strategic_plans_created_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.org_workspace_strategic_plans_owner_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.organization_memberships_invited_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.organization_messages_sent_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.survey_responses_assignment_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.survey_responses_survey_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.survey_responses_user_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.course_assignments_course_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.course_assignments_organization_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.course_assignments_user_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.courses_created_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.notifications_recipient_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.course_media_assets_course_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.notifications_created_at_desc_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.course_media_assets_storage_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_posts_org_created_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_comments_post_created_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_post_reactions_post_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.certificates_course_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.certificates_organization_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.course_assignments_assigned_by_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.learner_journeys_organization_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.user_lesson_progress_organization_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.course_media_assets_lesson_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.course_media_assets_org_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_comments_parent_comment_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_comments_user_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_post_reactions_org_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_post_reactions_user_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_posts_org_pinned_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_reports_comment_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_reports_post_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_reports_reporter_user_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.documents_category_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.documents_visibility_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.documents_organization_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.documents_user_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.documents_created_at_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_reactions_org_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.team_huddle_reactions_user_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.user_gamification_profile_org_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.user_gamification_profile_last_active_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.user_achievements_user_time_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.user_achievements_org_time_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.user_activity_log_user_time_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.user_activity_log_org_time_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.user_activity_log_type_time_idx;

-- --- END DROP INDEXes ---

-- Recreate templates: run `scripts/collect_unused_index_defs.sql` to get exact CREATE INDEX definitions
-- Example (fill exact column list returned by the helper):
-- CREATE INDEX CONCURRENTLY assignments_user_id_idx ON public.assignments (user_id);

-- End of migration file
