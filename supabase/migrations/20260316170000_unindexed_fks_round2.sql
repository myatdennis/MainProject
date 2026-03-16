-- =============================================================================
-- Migration: Cover 18 additional unindexed foreign keys (round 2)
--
-- Note: The 15 indexes created in 20260316160000 are flagged as "unused" by
-- the linter solely because they are brand-new (idx_scan = 0). They are
-- required FK covering indexes and must NOT be dropped.
-- =============================================================================

-- course_engagement → organization_id
create index if not exists course_engagement_organization_id_idx
  on public.course_engagement(organization_id)
  where organization_id is not null;

-- documents → user_id
create index if not exists documents_user_id_idx
  on public.documents(user_id)
  where user_id is not null;

-- email_logs → organization_id
create index if not exists email_logs_organization_id_idx
  on public.email_logs(organization_id)
  where organization_id is not null;

-- lessons → organization_id
create index if not exists lessons_organization_id_idx
  on public.lessons(organization_id)
  where organization_id is not null;

-- message_logs → org_id  (separate FK column from organization_id)
create index if not exists message_logs_org_id_idx
  on public.message_logs(org_id)
  where org_id is not null;

-- message_logs → organization_id
create index if not exists message_logs_organization_id_idx
  on public.message_logs(organization_id)
  where organization_id is not null;

-- modules → organization_id
create index if not exists modules_organization_id_idx
  on public.modules(organization_id)
  where organization_id is not null;

-- org_activation_events → org_id
create index if not exists org_activation_events_org_id_idx
  on public.org_activation_events(org_id)
  where org_id is not null;

-- org_invites → invited_by
create index if not exists org_invites_invited_by_idx
  on public.org_invites(invited_by)
  where invited_by is not null;

-- org_workspace_action_items → org_id
create index if not exists org_workspace_action_items_org_id_idx
  on public.org_workspace_action_items(org_id)
  where org_id is not null;

-- org_workspace_action_items → plan_id
create index if not exists org_workspace_action_items_plan_id_idx
  on public.org_workspace_action_items(plan_id)
  where plan_id is not null;

-- org_workspace_session_notes → org_id
create index if not exists org_workspace_session_notes_org_id_idx
  on public.org_workspace_session_notes(org_id)
  where org_id is not null;

-- org_workspace_strategic_plans → org_id
create index if not exists org_workspace_strategic_plans_org_id_idx
  on public.org_workspace_strategic_plans(org_id)
  where org_id is not null;

-- organization_messages → sent_by
create index if not exists organization_messages_sent_by_idx
  on public.organization_messages(sent_by)
  where sent_by is not null;

-- survey_responses → assignment_id
create index if not exists survey_responses_assignment_id_idx
  on public.survey_responses(assignment_id)
  where assignment_id is not null;

-- survey_responses → survey_id
create index if not exists survey_responses_survey_id_idx
  on public.survey_responses(survey_id)
  where survey_id is not null;

-- survey_responses → user_id
create index if not exists survey_responses_user_id_idx
  on public.survey_responses(user_id)
  where user_id is not null;

-- user_profiles → organization_id
create index if not exists user_profiles_organization_id_idx
  on public.user_profiles(organization_id)
  where organization_id is not null;
