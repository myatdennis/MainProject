-- Premium, subtle gamification system ("Growth Journey")
-- - Profiles: user_gamification_profile
-- - Achievements: user_achievements
-- - Activity log: user_activity_log
-- - Org rollups: org_engagement_metrics
--
-- Notes:
-- - Uses UUID ids aligned with current org + membership schema.
-- - RLS allows learners to read their own profile/activity/achievements.
-- - Org rollups readable by org admins via public.team_huddle_is_org_admin(org_id).

begin;

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- user_gamification_profile
-- ---------------------------------------------------------------------------
create table if not exists public.user_gamification_profile (
  user_id uuid primary key,
  org_id uuid references public.organizations(id) on delete set null,

  level integer not null default 1,
  growth_xp integer not null default 0,

  lesson_completion_count integer not null default 0,
  course_completion_count integer not null default 0,
  scenario_completion_count integer not null default 0,
  reflection_submission_count integer not null default 0,

  learning_streak_count integer not null default 0,
  reflection_streak_count integer not null default 0,

  learning_grace_days_remaining integer not null default 2,
  reflection_grace_days_remaining integer not null default 2,

  last_learning_date date,
  last_reflection_date date,
  last_active_date date,

  -- Rolling scenario score aggregates (kept subtle; used for Growth Insights).
  scenario_score_samples integer not null default 0,
  avg_empathy numeric(6,3) not null default 0,
  avg_inclusion numeric(6,3) not null default 0,
  avg_effectiveness numeric(6,3) not null default 0,

  milestones jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_gamification_profile_org_idx on public.user_gamification_profile(org_id);
create index if not exists user_gamification_profile_last_active_idx on public.user_gamification_profile(last_active_date);

drop trigger if exists user_gamification_profile_set_updated_at on public.user_gamification_profile;
create trigger user_gamification_profile_set_updated_at
  before update on public.user_gamification_profile
  for each row execute function public.set_updated_at();

alter table public.user_gamification_profile enable row level security;

drop policy if exists user_gamification_profile_service_full_access on public.user_gamification_profile;
create policy user_gamification_profile_service_full_access
  on public.user_gamification_profile
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists user_gamification_profile_self_read on public.user_gamification_profile;
create policy user_gamification_profile_self_read
  on public.user_gamification_profile
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_gamification_profile_self_write_deny on public.user_gamification_profile;
create policy user_gamification_profile_self_write_deny
  on public.user_gamification_profile
  for insert
  to authenticated
  with check (false);

-- ---------------------------------------------------------------------------
-- user_achievements
-- ---------------------------------------------------------------------------
create table if not exists public.user_achievements (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null,
  org_id uuid references public.organizations(id) on delete set null,
  achievement_type text not null,
  achieved_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists user_achievements_user_type_unique
  on public.user_achievements(user_id, achievement_type);
create index if not exists user_achievements_user_time_idx
  on public.user_achievements(user_id, achieved_at desc);
create index if not exists user_achievements_org_time_idx
  on public.user_achievements(org_id, achieved_at desc);

alter table public.user_achievements enable row level security;

drop policy if exists user_achievements_service_full_access on public.user_achievements;
create policy user_achievements_service_full_access
  on public.user_achievements
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists user_achievements_self_read on public.user_achievements;
create policy user_achievements_self_read
  on public.user_achievements
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_activity_log
-- ---------------------------------------------------------------------------
create table if not exists public.user_activity_log (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null,
  org_id uuid references public.organizations(id) on delete set null,
  course_id text,
  lesson_id text,
  activity_type text not null,
  source text not null default 'server',
  event_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists user_activity_log_event_unique
  on public.user_activity_log(event_id)
  where event_id is not null;
create index if not exists user_activity_log_user_time_idx
  on public.user_activity_log(user_id, created_at desc);
create index if not exists user_activity_log_org_time_idx
  on public.user_activity_log(org_id, created_at desc);
create index if not exists user_activity_log_type_time_idx
  on public.user_activity_log(activity_type, created_at desc);

alter table public.user_activity_log enable row level security;

drop policy if exists user_activity_log_service_full_access on public.user_activity_log;
create policy user_activity_log_service_full_access
  on public.user_activity_log
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists user_activity_log_self_read on public.user_activity_log;
create policy user_activity_log_self_read
  on public.user_activity_log
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- org_engagement_metrics
-- ---------------------------------------------------------------------------
create table if not exists public.org_engagement_metrics (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  avg_learning_streak numeric(8,3) not null default 0,
  avg_reflection_streak numeric(8,3) not null default 0,
  completion_rate numeric(8,3) not null default 0,
  engagement_score numeric(8,3) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists org_engagement_metrics_set_updated_at on public.org_engagement_metrics;
create trigger org_engagement_metrics_set_updated_at
  before update on public.org_engagement_metrics
  for each row execute function public.set_updated_at();

alter table public.org_engagement_metrics enable row level security;

drop policy if exists org_engagement_metrics_service_full_access on public.org_engagement_metrics;
create policy org_engagement_metrics_service_full_access
  on public.org_engagement_metrics
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists org_engagement_metrics_admin_read on public.org_engagement_metrics;
create policy org_engagement_metrics_admin_read
  on public.org_engagement_metrics
  for select
  to authenticated
  using (public.team_huddle_is_org_admin(org_id));

commit;
