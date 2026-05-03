-- Fix recursive RLS on organization_memberships.
-- The previous SELECT policy queried organization_memberships from inside
-- its own policy expression, which triggers Postgres 42P17 infinite recursion.

create or replace function public.is_org_admin_for(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = target_organization_id
      and m.status = 'active'
      and m.role = any (array['admin'::text, 'owner'::text])
  );
$$;

revoke all on function public.is_org_admin_for(uuid) from public;
grant execute on function public.is_org_admin_for(uuid) to authenticated;
grant select on public.organization_memberships to authenticated;

drop policy if exists organization_memberships_select_unified on public.organization_memberships;

create policy organization_memberships_select_unified
on public.organization_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_org_admin_for(organization_id)
  or ((select auth.jwt()) ->> 'role') = 'platform_admin'
);
