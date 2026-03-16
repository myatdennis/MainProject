-- ============================================================
-- Fix unindexed_foreign_keys + unused_index linter warnings
-- ============================================================

-- ── Part 1: Add missing FK covering indexes ─────────────────
-- certificates.course_id FK (certificates_course_id_fkey)
create index if not exists certificates_course_id_idx
  on public.certificates (course_id);

-- certificates.organization_id FK (certificates_organization_id_fkey)
create index if not exists certificates_organization_id_idx
  on public.certificates (organization_id);

-- course_assignments.assigned_by FK (course_assignments_assigned_by_fkey)
create index if not exists course_assignments_assigned_by_idx
  on public.course_assignments (assigned_by);

-- ── Part 2: Drop unused indexes ─────────────────────────────
-- These indexes have never been scanned (idx_scan = 0 across all tables).
-- Dropping them removes unnecessary write overhead.  They can be
-- re-created if query patterns warrant them after launch.

-- course_engagement
drop index if exists public.course_engagement_organization_id_idx;

-- documents
drop index if exists public.documents_user_id_idx;

-- email_logs
drop index if exists public.email_logs_organization_id_idx;
drop index if exists public.email_logs_sent_by_idx;

-- lessons
drop index if exists public.lessons_organization_id_idx;

-- message_logs
drop index if exists public.message_logs_sent_by_idx;

-- modules
drop index if exists public.modules_organization_id_idx;

-- notifications
drop index if exists public.notifications_created_by_idx;
drop index if exists public.notifications_organization_id_idx;

-- org_activation_events
drop index if exists public.org_activation_events_org_id_idx;
drop index if exists public.org_activation_events_actor_id_idx;

-- org_invites
drop index if exists public.org_invites_invited_by_idx;
drop index if exists public.org_invites_accepted_user_id_idx;
drop index if exists public.org_invites_created_by_idx;

-- org_workspace_action_items
drop index if exists public.org_workspace_action_items_org_id_idx;
drop index if exists public.org_workspace_action_items_plan_id_idx;
drop index if exists public.org_workspace_action_items_assignee_id_idx;
drop index if exists public.org_workspace_action_items_created_by_idx;

-- org_workspace_session_notes
drop index if exists public.org_workspace_session_notes_org_id_idx;
drop index if exists public.org_workspace_session_notes_author_id_idx;
drop index if exists public.org_workspace_session_notes_created_by_idx;

-- org_workspace_strategic_plans
drop index if exists public.org_workspace_strategic_plans_org_id_idx;
drop index if exists public.org_workspace_strategic_plans_created_by_idx;
drop index if exists public.org_workspace_strategic_plans_owner_id_idx;

-- organization_memberships
drop index if exists public.organization_memberships_invited_by_idx;

-- organization_messages
drop index if exists public.organization_messages_sent_by_idx;

-- survey_responses
drop index if exists public.survey_responses_assignment_id_idx;
drop index if exists public.survey_responses_survey_id_idx;
drop index if exists public.survey_responses_user_id_idx;

-- user_profiles
drop index if exists public.user_profiles_organization_id_idx;

-- course_assignments (unused indexes; the FK covering index above replaces assigned_by)
drop index if exists public.course_assignments_course_id_idx;
drop index if exists public.course_assignments_user_id_idx;
drop index if exists public.course_assignments_organization_id_idx;

-- courses
drop index if exists public.courses_created_by_idx;
