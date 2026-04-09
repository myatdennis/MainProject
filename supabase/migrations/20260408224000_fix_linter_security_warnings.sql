-- Supabase linter hardening:
-- - Fix WARN 0011_function_search_path_mutable by pinning search_path on affected functions.
-- - Fix ERROR 0010_security_definer_view by forcing the membership view to run with SECURITY INVOKER.

begin;

-- Trigger function used by course_media_assets updated_at trigger.
create or replace function public.course_media_assets_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Shared trigger function used across team huddle tables.
create or replace function public.team_huddle_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
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
set search_path = ''
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
set search_path = ''
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

-- Ensure the canonical membership view uses the querying user's permissions/RLS.
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_organizations_vw'
      and c.relkind = 'v'
  ) then
    execute 'alter view public.user_organizations_vw set (security_invoker = true)';
  end if;
end $$;

commit;
