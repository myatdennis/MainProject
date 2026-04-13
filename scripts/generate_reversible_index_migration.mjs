#!/usr/bin/env node
// scripts/generate_reversible_index_migration.mjs
// Connects to the Postgres DB specified by env (DATABASE_POOLER_URL or DATABASE_URL)
// and collects index definitions for the linter-reported index names, then
// writes a reversible migration file in migrations/.

import fs from 'fs';
import { Client } from 'pg';

const INDEX_NAMES = [
  'assignments_user_id_idx','assignments_updated_at_idx','survey_responses_assessment_type_idx',
  'surveys_assessment_type_idx','organization_memberships_user_id_idx','idx_course_engagement_course',
  'hdi_assessment_results_survey_id_idx','hdi_assessment_results_user_id_idx','hdi_assessment_results_org_id_idx',
  'org_invites_token_idx','surveys_org_idx','assignments_user_id_uuid_idx','org_invites_org_idx',
  'lesson_reflections_response_data_idx','lesson_reflections_org_course_idx','lesson_reflections_user_idx',
  'lesson_reflections_org_course_lesson_user_idx','lesson_reflections_org_course_module_idx','idx_org_activation_steps_org_id',
  'idx_documents_created_by','course_engagement_organization_id_idx','documents_user_id_idx','analytics_events_org_id_idx',
  'idx_courses_org','email_logs_organization_id_idx','email_logs_sent_by_idx','lessons_organization_id_idx',
  'org_activation_steps_org_idx','idx_lessons_module','idx_lessons_course','analytics_events_user_id_idx',
  'message_logs_sent_by_idx','modules_organization_id_idx','notifications_created_by_idx',
  'org_workspace_action_items_org_workspace_action_items_org_id_idx','org_workspace_action_items_plan_id_idx',
  'org_workspace_action_items_assignee_id_idx','org_workspace_action_items_created_by_idx',
  'org_workspace_session_notes_org_id_idx','org_workspace_session_notes_author_id_idx','org_workspace_session_notes_created_by_idx',
  'org_activation_events_org_id_idx','org_activation_events_actor_id_idx','org_invites_invited_by_idx',
  'org_invites_accepted_user_id_idx','org_invites_created_by_idx','org_workspace_strategic_plans_org_workspace_strategic_plans_org_id_idx',
  'org_workspace_strategic_plans_created_by_idx','org_workspace_strategic_plans_owner_id_idx','organization_memberships_invited_by_idx',
  'organization_messages_sent_by_idx','survey_responses_assignment_id_idx','survey_responses_survey_id_idx','survey_responses_user_id_idx',
  'course_assignments_course_id_idx','course_assignments_organization_id_idx','course_assignments_user_id_idx','courses_created_by_idx',
  'notifications_recipient_idx','course_media_assets_course_idx','notifications_created_at_desc_idx','course_media_assets_storage_idx',
  'team_huddle_posts_org_created_idx','team_huddle_comments_post_created_idx','team_huddle_post_reactions_post_idx',
  'certificates_course_id_idx','certificates_organization_id_idx','course_assignments_assigned_by_idx','learner_journeys_organization_id_idx',
  'user_lesson_progress_organization_id_idx','course_media_assets_lesson_idx','course_media_assets_org_idx',
  'team_huddle_comments_parent_comment_idx','team_huddle_comments_user_idx','team_huddle_post_reactions_org_idx',
  'team_huddle_post_reactions_user_idx','team_huddle_posts_org_pinned_idx','team_huddle_reports_comment_idx','team_huddle_reports_post_idx',
  'team_huddle_reports_reporter_user_idx','documents_category_idx','documents_visibility_idx','documents_organization_idx',
  'documents_user_idx','documents_created_at_idx','team_huddle_reactions_org_idx','team_huddle_reactions_user_idx',
  'user_gamification_profile_org_idx','user_gamification_profile_last_active_idx','user_achievements_user_time_idx',
  'user_achievements_org_time_idx','user_activity_log_user_time_idx','user_activity_log_org_time_idx','user_activity_log_type_time_idx'
];

const outPath = 'migrations/2026-04-13_drop_unused_indexes_reversible.sql';

async function main() {
  const dbUrl = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Set DATABASE_POOLER_URL or DATABASE_URL in your environment before running this script.');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  // Query pg_class and pg_get_indexdef for each index name
  const q = `
    SELECT
      i.schemaname AS schema_name,
      i.tablename AS table_name,
      i.indexname AS index_name,
      pg_get_indexdef(c.oid) AS index_definition,
      pg_relation_size(c.oid) AS index_size_bytes
    FROM pg_indexes i
    JOIN pg_class c ON c.relname = i.indexname AND c.relkind = 'i'
    WHERE i.indexname = ANY($1::text[])
    ORDER BY index_size_bytes DESC
  `;

  const res = await client.query(q, [INDEX_NAMES]);

  if (res.rowCount === 0) {
    console.log('No matching indexes found in the database. Exiting.');
    await client.end();
    process.exit(0);
  }

  // Build migration content
  let applyStatements = [];
  let rollbackStatements = [];

  for (const row of res.rows) {
    const idxName = row.index_name;
    const idxDef = row.index_definition;
    // We will drop using the index name qualified with schema if provided
    const schema = row.schema_name || 'public';
    applyStatements.push(`DROP INDEX CONCURRENTLY IF EXISTS ${schema}.${idxName};`);

    // For rollback, use the exact CREATE INDEX statement as returned (pg_get_indexdef)
    // pg_get_indexdef returns the CREATE INDEX command without the semicolon in some PG versions; ensure semicolon
    rollbackStatements.push(`${idxDef.endsWith(';') ? idxDef : idxDef + ';'}`);
  }

  const header = `-- Reversible migration generated by scripts/generate_reversible_index_migration.mjs
-- Date: ${new Date().toISOString()}
-- WARNING: verify the CREATE INDEX statements in the ROLLBACK section before running the rollback.
-- This migration drops indexes using DROP INDEX CONCURRENTLY (no transaction). Rollback will attempt to recreate the indexes.

`;

  const content = [
    header,
    '-- === APPLY: drop unused indexes ===',
    applyStatements.join('\n'),
    '\n\n-- === ROLLBACK: recreate indexes ===',
    '-- The following CREATE INDEX statements can be used to recreate the dropped indexes (run them with CONCURRENTLY where supported).',
    rollbackStatements.join('\n'),
    '\n'
  ].join('\n');

  fs.writeFileSync(outPath, content, { encoding: 'utf8', flag: 'w' });

  console.log(`Wrote reversible migration to ${outPath} (review before applying).`);
  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
