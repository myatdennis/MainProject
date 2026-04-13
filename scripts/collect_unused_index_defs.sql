-- Helper: collect index definitions and sizes for a list of indexes
-- Run this against your Postgres database to get the exact CREATE INDEX definitions
-- Example: psql "$DATABASE_URL" -f scripts/collect_unused_index_defs.sql

WITH target_index_names AS (
  SELECT unnest(ARRAY[
    'assignments_user_id_idx', 'assignments_updated_at_idx', 'survey_responses_assessment_type_idx',
    'surveys_assessment_type_idx', 'organization_memberships_user_id_idx', 'idx_course_engagement_course',
    'hdi_assessment_results_survey_id_idx', 'hdi_assessment_results_user_id_idx', 'hdi_assessment_results_org_id_idx',
    'org_invites_token_idx', 'surveys_org_idx', 'assignments_user_id_uuid_idx', 'org_invites_org_idx',
    'lesson_reflections_response_data_idx', 'lesson_reflections_org_course_idx', 'lesson_reflections_user_idx',
    'lesson_reflections_org_course_lesson_user_idx', 'lesson_reflections_org_course_module_idx', 'idx_org_activation_steps_org_id',
    'idx_documents_created_by', 'course_engagement_organization_id_idx', 'documents_user_id_idx', 'analytics_events_org_id_idx',
    'idx_courses_org', 'email_logs_organization_id_idx', 'email_logs_sent_by_idx', 'lessons_organization_id_idx',
    'org_activation_steps_org_idx', 'idx_lessons_module', 'idx_lessons_course', 'analytics_events_user_id_idx',
    'message_logs_sent_by_idx', 'modules_organization_id_idx', 'notifications_created_by_idx',
    'org_workspace_action_items_org_workspace_action_items_org_id_idx', 'org_workspace_action_items_plan_id_idx',
    'org_workspace_action_items_assignee_id_idx', 'org_workspace_action_items_created_by_idx',
    'org_workspace_session_notes_org_id_idx', 'org_workspace_session_notes_author_id_idx', 'org_workspace_session_notes_created_by_idx',
    'org_activation_events_org_id_idx', 'org_activation_events_actor_id_idx', 'org_invites_invited_by_idx',
    'org_invites_accepted_user_id_idx', 'org_invites_created_by_idx', 'org_workspace_strategic_plans_org_workspace_strategic_plans_org_id_idx',
    'org_workspace_strategic_plans_created_by_idx', 'org_workspace_strategic_plans_owner_id_idx', 'organization_memberships_invited_by_idx',
    'organization_messages_sent_by_idx', 'survey_responses_assignment_id_idx', 'survey_responses_survey_id_idx', 'survey_responses_user_id_idx',
    'course_assignments_course_id_idx', 'course_assignments_organization_id_idx', 'course_assignments_user_id_idx', 'courses_created_by_idx',
    'notifications_recipient_idx', 'course_media_assets_course_idx', 'notifications_created_at_desc_idx', 'course_media_assets_storage_idx',
    'team_huddle_posts_org_created_idx', 'team_huddle_comments_post_created_idx', 'team_huddle_post_reactions_post_idx',
    'certificates_course_id_idx', 'certificates_organization_id_idx', 'course_assignments_assigned_by_idx', 'learner_journeys_organization_id_idx',
    'user_lesson_progress_organization_id_idx', 'course_media_assets_lesson_idx', 'course_media_assets_org_idx',
    'team_huddle_comments_parent_comment_idx', 'team_huddle_comments_user_idx', 'team_huddle_post_reactions_org_idx',
    'team_huddle_post_reactions_user_idx', 'team_huddle_posts_org_pinned_idx', 'team_huddle_reports_comment_idx', 'team_huddle_reports_post_idx',
    'team_huddle_reports_reporter_user_idx', 'documents_category_idx', 'documents_visibility_idx', 'documents_organization_idx',
    'documents_user_idx', 'documents_created_at_idx', 'team_huddle_reactions_org_idx', 'team_huddle_reactions_user_idx',
    'user_gamification_profile_org_idx', 'user_gamification_profile_last_active_idx', 'user_achievements_user_time_idx',
    'user_achievements_org_time_idx', 'user_activity_log_user_time_idx', 'user_activity_log_org_time_idx', 'user_activity_log_type_time_idx'
  ]) AS name
)

SELECT
  i.schemaname AS schema_name,
  i.tablename AS table_name,
  i.indexname AS index_name,
  pg_get_indexdef(idx.indexrelid) AS index_definition,
  pg_size_pretty(pg_relation_size(idx.indexrelid)) AS index_size,
  pg_relation_size(idx.indexrelid) AS index_size_bytes
FROM pg_indexes i
JOIN target_index_names t ON i.indexname = t.name
JOIN pg_class c ON c.relname = i.indexname AND c.relkind = 'i'
JOIN pg_index idx ON idx.indexrelid = c.oid
ORDER BY index_size_bytes DESC;

-- Notes:
-- * This outputs the exact CREATE INDEX (index_definition) that you can copy to re-create an index.
-- * If the helper returns no rows for an index name, that index either doesn't exist or is in a different schema.
-- * After running this, copy the `index_definition` column values into a safe place before running the DROP migration.

