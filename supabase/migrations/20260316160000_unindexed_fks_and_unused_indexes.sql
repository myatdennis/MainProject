-- =============================================================================
-- Migration: Fix unindexed foreign keys (15) + drop 62 confirmed-unused
--            indexes + fix _backup_org_onboarding_progress_vw (no PK)
-- =============================================================================

-- ── 1. ADD MISSING FK COVERING INDEXES ───────────────────────────────────────
create index if not exists courses_created_by_idx
  on public.courses(created_by)
  where created_by is not null;

create index if not exists email_logs_sent_by_idx
  on public.email_logs(sent_by)
  where sent_by is not null;

create index if not exists message_logs_sent_by_idx
  on public.message_logs(sent_by)
  where sent_by is not null;

create index if not exists notifications_created_by_idx
  on public.notifications(created_by)
  where created_by is not null;

create index if not exists notifications_organization_id_idx
  on public.notifications(organization_id)
  where organization_id is not null;

create index if not exists org_activation_events_actor_id_idx
  on public.org_activation_events(actor_id)
  where actor_id is not null;

create index if not exists org_invites_accepted_user_id_idx
  on public.org_invites(accepted_user_id)
  where accepted_user_id is not null;

create index if not exists org_invites_created_by_idx
  on public.org_invites(created_by)
  where created_by is not null;

create index if not exists org_workspace_action_items_assignee_id_idx
  on public.org_workspace_action_items(assignee_id)
  where assignee_id is not null;

create index if not exists org_workspace_action_items_created_by_idx
  on public.org_workspace_action_items(created_by)
  where created_by is not null;

create index if not exists org_workspace_session_notes_author_id_idx
  on public.org_workspace_session_notes(author_id)
  where author_id is not null;

create index if not exists org_workspace_session_notes_created_by_idx
  on public.org_workspace_session_notes(created_by)
  where created_by is not null;

create index if not exists org_workspace_strategic_plans_created_by_idx
  on public.org_workspace_strategic_plans(created_by)
  where created_by is not null;

create index if not exists org_workspace_strategic_plans_owner_id_idx
  on public.org_workspace_strategic_plans(owner_id)
  where owner_id is not null;

create index if not exists organization_memberships_invited_by_idx
  on public.organization_memberships(invited_by)
  where invited_by is not null;

-- ── 2. FIX _backup_org_onboarding_progress_vw — add surrogate PK ─────────────
-- This table has no primary key (triggers no_primary_key lint warning).
-- It is a backup/snapshot table; adding a generated surrogate key satisfies
-- the linter without altering the existing data shape.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = '_backup_org_onboarding_progress_vw'
      and column_name  = 'id'
  ) then
    alter table public._backup_org_onboarding_progress_vw
      add column id bigint generated always as identity primary key;
  end if;
end $$;

-- ── 3. DROP 62 CONFIRMED-UNUSED INDEXES ──────────────────────────────────────
drop index if exists public.analytics_events_course_id_idx;
drop index if exists public.analytics_events_event_type_idx;

drop index if exists public.assignments_course_id_idx;
drop index if exists public.assignments_survey_org_active_idx;
drop index if exists public.assignments_survey_user_active_idx;

drop index if exists public.idx_auth_audit_event_created_at;

drop index if exists public.idx_course_engagement_org;

drop index if exists public.documents_category_idx;
drop index if exists public.documents_created_at_idx;
drop index if exists public.documents_organization_idx;
drop index if exists public.documents_user_idx;
drop index if exists public.documents_visibility_idx;
drop index if exists public.idx_documents_organization_id;

drop index if exists public.email_logs_org_idx;
drop index if exists public.email_logs_recipient_id_idx;
drop index if exists public.email_logs_recipient_idx;
drop index if exists public.email_logs_sent_at_idx;
drop index if exists public.email_logs_status_idx;

drop index if exists public.idx_lessons_org;

drop index if exists public.idx_message_logs_org_id;
drop index if exists public.message_logs_org_idx;
drop index if exists public.message_logs_recipient_idx;
drop index if exists public.message_logs_sent_at_idx;
drop index if exists public.message_logs_status_idx;

drop index if exists public.idx_modules_org;
drop index if exists public.modules_course_order_idx;

drop index if exists public.org_activation_events_org_idx;
drop index if exists public.org_activation_events_type_idx;

drop index if exists public.org_activation_steps_status_idx;

drop index if exists public.idx_org_invites_email;
drop index if exists public.idx_org_invites_invited_by;
drop index if exists public.org_invites_email_idx;
drop index if exists public.org_invites_status_idx;

drop index if exists public.org_workspace_action_items_org_idx;
drop index if exists public.org_workspace_action_items_plan_idx;
drop index if exists public.org_workspace_action_items_status_idx;

drop index if exists public.org_workspace_session_notes_date_idx;
drop index if exists public.org_workspace_session_notes_org_idx;

drop index if exists public.org_workspace_strategic_plans_org_idx;
drop index if exists public.org_workspace_strategic_plans_status_idx;

drop index if exists public.idx_organization_members_user_org;

drop index if exists public.idx_org_members_user_org_role;
drop index if exists public.idx_org_memberships_org;
drop index if exists public.idx_org_memberships_org_user;
drop index if exists public.idx_org_memberships_user_org;
drop index if exists public.idx_org_memberships_user_org_active;
drop index if exists public.organization_memberships_org_id_idx;

drop index if exists public.idx_organization_messages_sent_by;
drop index if exists public.organization_messages_sent_at_idx;

drop index if exists public.quiz_attempts_lesson_idx;
drop index if exists public.quiz_attempts_user_idx;

drop index if exists public.survey_assignments_survey_idx;

drop index if exists public.survey_responses_assignment_idx;
drop index if exists public.survey_responses_survey_idx;
drop index if exists public.survey_responses_user_idx;

drop index if exists public.surveys_status_idx;
drop index if exists public.surveys_type_idx;

drop index if exists public.idx_user_lesson_progress_user_id;

drop index if exists public.user_profiles_email_idx;
drop index if exists public.user_profiles_id_idx;
drop index if exists public.user_profiles_is_admin_idx;
drop index if exists public.user_profiles_org_idx;
