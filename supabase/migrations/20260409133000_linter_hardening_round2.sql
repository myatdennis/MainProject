-- Supabase database linter hardening (round 2):
-- - Ensure FK columns have covering indexes (lint 0001).
-- - Pin search_path for security-sensitive functions (lint 0011).
-- - Ensure membership view runs with invoker privileges (lint 0010).

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0001: Unindexed foreign keys
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists lesson_reflections_course_idx
  on public.lesson_reflections (course_id);

create index if not exists lesson_reflections_lesson_idx
  on public.lesson_reflections (lesson_id);

create index if not exists lesson_reflections_module_idx
  on public.lesson_reflections (module_id);

create index if not exists team_huddle_comments_org_idx
  on public.team_huddle_comments (organization_id);

create index if not exists team_huddle_comments_parent_comment_idx
  on public.team_huddle_comments (parent_comment_id);

create index if not exists team_huddle_comments_user_idx
  on public.team_huddle_comments (user_id);

create index if not exists team_huddle_post_reactions_org_idx
  on public.team_huddle_post_reactions (organization_id);

create index if not exists team_huddle_post_reactions_user_idx
  on public.team_huddle_post_reactions (user_id);

create index if not exists team_huddle_posts_user_idx
  on public.team_huddle_posts (user_id);

create index if not exists team_huddle_reports_comment_idx
  on public.team_huddle_reports (comment_id);

create index if not exists team_huddle_reports_post_idx
  on public.team_huddle_reports (post_id);

create index if not exists team_huddle_reports_reporter_user_idx
  on public.team_huddle_reports (reporter_user_id);

create index if not exists team_huddle_reactions_org_idx
  on public.team_huddle_reactions (organization_id);

create index if not exists team_huddle_reactions_user_idx
  on public.team_huddle_reactions (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 0011: Function search_path mutable
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.course_media_assets_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.team_huddle_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.team_huddle_is_org_member(org_id uuid)
returns boolean
language sql
stable
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and coalesce(m.status, 'active') = 'active'
      and coalesce(m.is_active, true) = true
  );
$$;

create or replace function public.team_huddle_is_org_admin(org_id uuid)
returns boolean
language sql
stable
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and coalesce(m.status, 'active') = 'active'
      and coalesce(m.is_active, true) = true
      and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'platform_admin')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0010: Security definer view
-- ─────────────────────────────────────────────────────────────────────────────

drop view if exists public.user_organizations_vw;

create view public.user_organizations_vw
with (security_invoker = true)
as
select
  m.user_id,
  m.organization_id,
  m.role,
  coalesce(m.status, 'active') as status,
  coalesce(m.is_active, true) as is_active,
  m.accepted_at,
  m.created_at,
  m.updated_at,
  m.last_seen_at,
  o.name as organization_name,
  o.slug as organization_slug,
  o.status as organization_status,
  o.subscription,
  o.features
from public.organization_memberships as m
join public.organizations as o
  on o.id = m.organization_id;

grant select on public.user_organizations_vw to anon;
grant select on public.user_organizations_vw to authenticated;
grant select on public.user_organizations_vw to service_role;

commit;

